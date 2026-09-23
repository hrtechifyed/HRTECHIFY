import { getSupabase, supabaseConfigured } from "./supabase-client.js";
import { loadDemoState, saveDemoState, createDemoOrganization, addDemoEmployee, addDemoDocument, updateDemoTask, addDemoMessage } from "./store.js";

export class Repository {
  constructor() {
    this.demo = !supabaseConfigured();
    this.state = this.demo ? loadDemoState() : null;
    this.user = null;
    this.organization = null;
    this.membership = null;
    this.subscription = null;
  }

  async init() {
    if (this.demo) {
      this.organization = this.state.organization;
      this.subscription = this.state.subscription;
      this.membership = this.organization ? { role: "admin", organization_id: this.organization.id } : null;
      return this.snapshot();
    }
    const sb = await getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    this.user = user || null;
    if (!user) return this.snapshot();
    try { await sb.rpc("claim_pending_employee"); } catch { /* no pending invite is normal */ }
    const { data: memberships } = await sb.from("memberships").select("id, role, organization_id, organizations(id,name,slug,country,tone)").limit(1);
    if (memberships?.length) {
      this.membership = memberships[0];
      this.organization = memberships[0].organizations;
      const { data: sub } = await sb.from("subscriptions").select("*").eq("organization_id", this.organization.id).maybeSingle();
      this.subscription = sub;
    }
    return this.snapshot();
  }

  snapshot() {
    return { demo: this.demo, user: this.user, organization: this.organization, membership: this.membership, subscription: this.subscription };
  }

  async signIn(email, password) {
    const sb = await getSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return this.init();
  }

  async signUp(email, password) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    if (!this.demo) (await getSupabase()).auth.signOut();
    this.user = null; this.organization = null; this.membership = null;
  }

  async createOrganization(input) {
    if (this.demo) {
      this.organization = createDemoOrganization(this.state, input);
      this.membership = { role: "admin", organization_id: this.organization.id };
      this.subscription = this.state.subscription;
      return this.organization;
    }
    const sb = await getSupabase();
    const user = (await sb.auth.getUser()).data.user;
    const slugBase = input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const { data, error } = await sb.from("organizations").insert({
      name: input.name,
      slug: `${slugBase}-${Math.random().toString(36).slice(2,6)}`,
      country: input.country,
      tone: input.tone,
      created_by: user.id,
    }).select().single();
    if (error) throw error;
    await this.init();
    return data;
  }

  async employees() {
    if (this.demo) return this.state.employees.filter(e => e.organizationId === this.organization?.id);
    const sb = await getSupabase();
    const { data, error } = await sb.from("employees").select("*").eq("organization_id", this.organization.id).order("created_at");
    if (error) throw error;
    return (data || []).map(mapEmployee);
  }

  async addEmployee(input) {
    if (this.demo) return addDemoEmployee(this.state, input);
    const sb = await getSupabase();
    const { data, error } = await sb.from("employees").insert({
      organization_id: this.organization.id,
      name: input.name,
      email: input.email,
      role_title: input.roleTitle,
      team_name: input.teamName,
      manager_name: input.managerName,
      location: input.location,
      joining_date: input.joiningDate,
      status: input.status || "active",
    }).select().single();
    if (error) {
      if ((error.message || "").includes("SEAT_LIMIT_REACHED")) { const e = new Error("SEAT_LIMIT_REACHED"); e.code = "SEAT_LIMIT_REACHED"; throw e; }
      throw error;
    }
    return mapEmployee(data);
  }

  async documents() {
    if (this.demo) return this.state.documents.filter(d => d.organizationId === this.organization?.id);
    const sb = await getSupabase();
    const { data, error } = await sb.from("documents").select("*").eq("organization_id", this.organization.id).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(d => ({ id:d.id, organizationId:d.organization_id, fileName:d.file_name, category:d.category, createdAt:d.created_at }));
  }

  async chunks() {
    if (this.demo) return this.state.chunks.filter(c => c.organizationId === this.organization?.id);
    const sb = await getSupabase();
    const { data, error } = await sb.from("knowledge_chunks").select("id,document_id,chunk_index,content,documents(file_name,category)").eq("organization_id", this.organization.id).limit(5000);
    if (error) throw error;
    return (data || []).map(c => ({ id:c.id, organizationId:this.organization.id, documentId:c.document_id, chunkIndex:c.chunk_index, content:c.content, fileName:c.documents?.file_name, category:c.documents?.category }));
  }

  async addKnowledge(file, document, chunks) {
    if (this.demo) {
      addDemoDocument(this.state, document, chunks);
      return document;
    }
    const sb = await getSupabase();
    const path = `${this.organization.id}/${document.id}/${file.name}`;
    const up = await sb.storage.from("company-knowledge").upload(path, file, { upsert: false });
    if (up.error) throw up.error;
    const { error: docError } = await sb.from("documents").insert({
      id: document.id,
      organization_id: this.organization.id,
      file_name: file.name,
      storage_path: path,
      category: document.category,
      uploaded_by: this.user.id,
    });
    if (docError) throw docError;
    const rows = chunks.map(c => ({ id:c.id, organization_id:this.organization.id, document_id:document.id, chunk_index:c.chunkIndex, content:c.content }));
    for (let i=0; i<rows.length; i+=100) {
      const { error } = await sb.from("knowledge_chunks").insert(rows.slice(i,i+100));
      if (error) throw error;
    }
    return document;
  }

  async tasks(employeeId) {
    if (this.demo) return this.state.tasks.filter(t => t.employeeId === employeeId);
    const sb = await getSupabase();
    const { data, error } = await sb.from("onboarding_tasks").select("*").eq("employee_id", employeeId).order("due_offset_days");
    if (error) throw error;
    return (data || []).map(t => ({ id:t.id, employeeId:t.employee_id, title:t.title, description:t.description, dueOffsetDays:t.due_offset_days, status:t.status, source:t.source }));
  }

  async completeTask(taskId) {
    if (this.demo) return updateDemoTask(this.state, taskId, "completed");
    const sb = await getSupabase();
    const { error } = await sb.from("onboarding_tasks").update({ status:"completed", completed_at:new Date().toISOString() }).eq("id", taskId);
    if (error) throw error;
  }

  async messages(employeeId) {
    if (this.demo) return this.state.messages[employeeId] || [];
    const sb = await getSupabase();
    const { data } = await sb.from("agent_messages").select("role,content,sources,created_at").eq("employee_id", employeeId).order("created_at").limit(50);
    return (data || []).map(m => ({ role:m.role, content:m.content, sources:m.sources || [], createdAt:m.created_at }));
  }

  async addMessage(employeeId, message) {
    if (this.demo) return addDemoMessage(this.state, employeeId, message);
    const sb = await getSupabase();
    await sb.from("agent_messages").insert({ organization_id:this.organization.id, employee_id:employeeId, user_id:this.user.id, role:message.role, content:message.content, sources:message.sources || [] });
  }

  async activeSeatSummary() {
    const emps = await this.employees();
    const active = emps.filter(e => e.status === "active").length;
    const included = Number(this.subscription?.included_seats ?? this.subscription?.includedSeats ?? 3);
    const paid = Number(this.subscription?.paid_seats ?? this.subscription?.paidSeats ?? 0);
    return { active, included, paid, limit: included + paid };
  }
}

function mapEmployee(e) {
  return { id:e.id, organizationId:e.organization_id, name:e.name, email:e.email, roleTitle:e.role_title, teamName:e.team_name, managerName:e.manager_name, location:e.location, joiningDate:e.joining_date, status:e.status, authUserId:e.auth_user_id, createdAt:e.created_at };
}
