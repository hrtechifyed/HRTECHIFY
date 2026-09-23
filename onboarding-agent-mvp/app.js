import { CONFIG } from "./config.js";
import { Repository } from "./repository.js";
import { extractText, classifyDocument, chunkText } from "./knowledge.js";
import { loadLocalAI, localAIStatus } from "./local-llm.js";
import { runAgent, onboardingStage } from "./agent.js";
import { priceLabel, startUpgrade } from "./billing.js";

const repo = new Repository();
const root = document.querySelector("#app");
const ui = { page:"home", employees:[], documents:[], chunks:[], selectedEmployee:null, tasks:[], messages:[], busy:false, toast:null };

const icons = {
  spark:`<svg viewBox="0 0 24 24"><path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z"/><path d="m18 15 .9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15Z"/></svg>`,
  building:`<svg viewBox="0 0 24 24"><path d="M4 21V4h10v17M14 9h6v12M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1M2 21h20"/></svg>`,
  book:`<svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>`,
  users:`<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  chat:`<svg viewBox="0 0 24 24"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>`,
  card:`<svg viewBox="0 0 24 24"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>`,
};

function esc(v="") { return String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c])); }
function md(text="") { return esc(text).replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\n/g,"<br>"); }
function fmtDate(d) { return d ? new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date(`${d}T00:00:00`)) : "—"; }
function toast(message, type="ok") { ui.toast={message,type}; render(); setTimeout(()=>{ui.toast=null; render();},2600); }

async function refresh() {
  if (!repo.organization) return;
  [ui.employees, ui.documents, ui.chunks] = await Promise.all([repo.employees(), repo.documents(), repo.chunks()]);
  if (ui.selectedEmployee) {
    ui.selectedEmployee = ui.employees.find(e=>e.id===ui.selectedEmployee.id) || ui.employees[0] || null;
  } else ui.selectedEmployee = ui.employees[0] || null;
  if (ui.selectedEmployee) {
    [ui.tasks, ui.messages] = await Promise.all([repo.tasks(ui.selectedEmployee.id), repo.messages(ui.selectedEmployee.id)]);
  } else { ui.tasks=[]; ui.messages=[]; }
}

function navItem(page,label,icon) { return `<button class="nav-item ${ui.page===page?'active':''}" data-nav="${page}"><span class="icon">${icons[icon]}</span>${label}</button>`; }

function shell(content) {
  const org = repo.organization;
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">${icons.spark}</span><span>${esc(CONFIG.productName)}</span></div>
      <div class="workspace-chip"><span class="avatar">${esc((org?.name||"D")[0])}</span><div><small>Workspace</small><strong>${esc(org?.name||"Demo")}</strong></div></div>
      <nav>${navItem("home","Overview","building")}${(repo.demo||repo.membership?.role==="admin")?navItem("knowledge","Knowledge","book")+navItem("employees","Employees","users"):""}${navItem("agent","Onboarding Agent","chat")}${(repo.demo||repo.membership?.role==="admin")?navItem("billing","Plan & Billing","card"):""}</nav>
      <div class="sidebar-foot"><span class="mode-dot ${repo.demo?'demo':'live'}"></span>${repo.demo?'Demo mode · local browser':'Connected · Supabase'}<button id="signoutBtn" class="text-btn">${repo.demo?'Reset demo':'Sign out'}</button></div>
    </aside>
    <main class="main"><header class="topbar"><div><span class="eyebrow">${esc(org?.country||'Company workspace')}</span><h1>${pageTitle()}</h1></div><div class="top-actions"><span class="pill">3 seats free</span></div></header>${content}</main>
    ${ui.toast?`<div class="toast ${ui.toast.type}">${esc(ui.toast.message)}</div>`:''}
  </div>`;
}

function pageTitle(){ return ({home:"Onboarding command center",knowledge:"Company knowledge",employees:"Employees",agent:"Onboarding Agent",billing:"Plan & billing"})[ui.page]; }

function setupScreen() {
  return `<div class="setup-wrap"><div class="setup-hero"><div class="logo-big">${icons.spark}</div><span class="eyebrow">Multi-company onboarding agent</span><h1>Turn company knowledge into a guided employee onboarding experience.</h1><p>One agent engine. Separate company workspaces. Three active employees free, then a paid-seat gate.</p></div><form id="setupForm" class="setup-card"><h2>Create your first workspace</h2><label>Company name<input name="name" required placeholder="e.g. NovaTech" /></label><div class="field-row"><label>Country<input name="country" required value="India" /></label><label>Tone<select name="tone"><option>Warm & professional</option><option>Professional</option><option>Friendly</option></select></label></div><button class="primary" type="submit">Create workspace</button><p class="fineprint">${repo.demo?'No backend is connected yet, so this workspace stays only in this browser.':'Your workspace will be protected by Supabase Row Level Security.'}</p></form></div>`;
}

function authScreen() {
  return `<div class="auth-wrap"><div class="auth-side"><div class="brand light"><span class="brand-mark">${icons.spark}</span><span>${esc(CONFIG.productName)}</span></div><h1>Company-specific onboarding.<br>One reusable agent.</h1><p>Upload approved knowledge, onboard employees and track progress without mixing one company’s data with another.</p></div><div class="auth-card"><div class="tab-row"><button class="tab active" data-auth-tab="signin">Sign in</button><button class="tab" data-auth-tab="signup">Create account</button></div><form id="authForm"><input type="hidden" name="mode" value="signin"><label>Work email<input name="email" type="email" required></label><label>Password<input name="password" type="password" minlength="8" required></label><button class="primary" type="submit">Sign in</button><p id="authHint" class="fineprint">Employees invited by email are automatically linked after sign-in.</p></form></div></div>`;
}

function overview() {
  const active = ui.employees.filter(e=>e.status==='active').length;
  const done = ui.tasks.filter(t=>t.status==='completed').length;
  const total = ui.tasks.length;
  return `<section class="grid stats"><div class="stat-card accent"><span>Active employees</span><strong>${active}<small>/ 3 free</small></strong><p>${active<3?`${3-active} free seat${3-active===1?'':'s'} remaining`:'Paid seats required for the next active employee'}</p></div><div class="stat-card"><span>Knowledge sources</span><strong>${ui.documents.length}</strong><p>${ui.chunks.length} searchable knowledge chunks</p></div><div class="stat-card"><span>Selected employee progress</span><strong>${total?Math.round(done/total*100):0}%</strong><p>${ui.selectedEmployee?esc(ui.selectedEmployee.name):'Add an employee to begin'}</p></div></section>
  <section class="panel hero-panel"><div><span class="eyebrow">The agent loop</span><h2>Observe → decide → use tools → guide the employee → remember progress.</h2><p>This is not only document Q&A. The agent can inspect onboarding stage, retrieve company knowledge, check open tasks and update progress.</p><div class="button-row"><button class="primary" data-nav="knowledge">Upload company knowledge</button><button class="secondary" data-nav="agent">Test the agent</button></div></div><div class="loop-visual"><div class="loop-core">AGENT</div><span>Profile</span><span>Knowledge</span><span>Tasks</span><span>Memory</span></div></section>
  <section class="two-col"><div class="panel"><div class="panel-head"><div><span class="eyebrow">Recent knowledge</span><h3>Approved sources</h3></div><button class="text-btn" data-nav="knowledge">Manage</button></div>${ui.documents.length?`<div class="list">${ui.documents.slice(0,4).map(d=>`<div class="list-row"><span class="file-icon">DOC</span><div><strong>${esc(d.fileName)}</strong><small>${esc(d.category||'General')}</small></div></div>`).join('')}</div>`:`<div class="empty">No sources yet. Upload a policy, handbook or onboarding guide.</div>`}</div><div class="panel"><div class="panel-head"><div><span class="eyebrow">Employee journey</span><h3>${ui.selectedEmployee?esc(ui.selectedEmployee.name):'No employee selected'}</h3></div></div>${ui.selectedEmployee?`<div class="journey"><span class="stage">${onboardingStage(ui.selectedEmployee)}</span><h4>${esc(ui.selectedEmployee.roleTitle||'Role not set')}</h4><p>${ui.tasks.filter(t=>t.status==='open').length} open onboarding actions</p><button class="secondary" data-nav="agent">Open companion</button></div>`:`<div class="empty">Add an employee to create their onboarding journey.</div>`}</div></section>`;
}

function knowledgePage() {
  return `<section class="panel upload-panel"><div><span class="eyebrow">RAG knowledge</span><h2>Upload what this company’s agent is allowed to know.</h2><p>PDF, DOCX, TXT, Markdown or CSV. The browser extracts and chunks the document; tenant controls decide who can retrieve it.</p></div><label class="upload-box"><input id="knowledgeInput" type="file" accept=".pdf,.docx,.txt,.md,.csv" multiple><span class="upload-plus">+</span><strong>Choose knowledge sources</strong><small>Maximum ${CONFIG.maxDocumentSizeMb} MB per file for this MVP</small></label></section><section class="panel"><div class="panel-head"><div><span class="eyebrow">Knowledge library</span><h3>${ui.documents.length} source${ui.documents.length===1?'':'s'}</h3></div></div>${ui.documents.length?`<div class="table"><div class="tr th"><span>Document</span><span>Category</span><span>Indexed</span></div>${ui.documents.map(d=>`<div class="tr"><span><strong>${esc(d.fileName)}</strong></span><span><span class="tag">${esc(d.category||'General')}</span></span><span>${ui.chunks.filter(c=>c.documentId===d.id).length} chunks</span></div>`).join('')}</div>`:`<div class="empty large">Your knowledge library is empty.<br><small>Start with an employee handbook, policies, culture/values, IT onboarding and team information.</small></div>`}</section>`;
}

function employeesPage() {
  const active=ui.employees.filter(e=>e.status==='active').length;
  return `<section class="seat-banner ${active>=3?'limit':''}"><div><span class="eyebrow">Seat model</span><strong>${active} active / 3 free</strong><p>${active<3?'The first three active onboarding employees are free.':'The next active employee requires a paid seat.'}</p></div><button class="secondary" data-nav="billing">View plan</button></section><section class="two-col employee-layout"><form id="employeeForm" class="panel form-panel"><span class="eyebrow">Add employee</span><h3>Create an onboarding journey</h3><label>Name<input name="name" required placeholder="Priya Sharma"></label><label>Work email<input type="email" name="email" required placeholder="priya@company.com"></label><div class="field-row"><label>Role<input name="roleTitle" placeholder="Product Manager"></label><label>Location<input name="location" placeholder="Bengaluru"></label></div><div class="field-row"><label>Team<input name="teamName" placeholder="Growth"></label><label>Manager<input name="managerName" placeholder="Rakesh Mehta"></label></div><label>Joining date<input type="date" name="joiningDate" value="${new Date().toISOString().slice(0,10)}"></label><button class="primary" type="submit">Add active employee</button></form><div class="panel"><div class="panel-head"><div><span class="eyebrow">Employees</span><h3>${ui.employees.length} total</h3></div></div>${ui.employees.length?`<div class="employee-list">${ui.employees.map(e=>`<button class="employee-card ${ui.selectedEmployee?.id===e.id?'selected':''}" data-employee="${e.id}"><span class="avatar large">${esc(e.name[0])}</span><div><strong>${esc(e.name)}</strong><small>${esc(e.roleTitle||'Role not set')} · ${esc(e.location||'Location not set')}</small><span class="mini-stage">${onboardingStage(e)}</span></div><span class="status ${e.status}">${e.status}</span></button>`).join('')}</div>`:`<div class="empty">No employees yet.</div>`}</div></section>`;
}

function agentPage() {
  if (!ui.employees.length) return `<section class="panel empty-state"><div class="orb">${icons.chat}</div><h2>Add an employee first</h2><p>The agent needs an employee profile and onboarding state before it can guide a journey.</p><button class="primary" data-nav="employees">Add employee</button></section>`;
  const emp=ui.selectedEmployee||ui.employees[0]; const ai=localAIStatus();
  return `<section class="agent-grid"><aside class="panel employee-context"><span class="eyebrow">Employee context</span><select id="employeeSelect">${ui.employees.map(e=>`<option value="${e.id}" ${e.id===emp.id?'selected':''}>${esc(e.name)}</option>`).join('')}</select><div class="person-card"><span class="avatar xlarge">${esc(emp.name[0])}</span><h3>${esc(emp.name)}</h3><p>${esc(emp.roleTitle||'Role not set')}</p></div><dl><div><dt>Stage</dt><dd>${onboardingStage(emp)}</dd></div><div><dt>Team</dt><dd>${esc(emp.teamName||'—')}</dd></div><div><dt>Manager</dt><dd>${esc(emp.managerName||'—')}</dd></div><div><dt>Location</dt><dd>${esc(emp.location||'—')}</dd></div></dl><div class="task-summary"><strong>${ui.tasks.filter(t=>t.status==='open').length}</strong><span>open tasks</span></div><div class="ai-engine"><span class="mode-dot ${ai.ready?'live':'demo'}"></span><div><strong>${ai.ready?'Local AI active':'Smart rules mode'}</strong><small>${ai.ready?CONFIG.localModelId:'Load a local model for LLM planning + synthesis'}</small></div></div>${!ai.ready?`<button id="loadAiBtn" class="secondary full">Load local AI</button><div id="modelProgress" class="progress-note"></div>`:''}</aside><div class="panel chat-panel"><div class="chat-head"><div><span class="eyebrow">Onboarding companion</span><h3>${esc(repo.organization.name)} × ${esc(emp.name)}</h3></div><span class="agent-badge">AGENT</span></div><div id="chatMessages" class="messages">${chatMessages(emp)}</div><div class="suggestions"><button data-prompt="What should I focus on today?">What should I focus on today?</button><button data-prompt="Tell me about my team and manager.">My team & manager</button><button data-prompt="Which policies should I read first?">Policies to read</button></div><form id="chatForm" class="chat-input"><textarea name="message" rows="1" placeholder="Ask about the company, your team, policies—or what you should do next." required></textarea><button type="submit" class="send">${icons.spark}</button></form></div></section>`;
}

function chatMessages(emp) {
  if (!ui.messages.length) return `<div class="message agent"><div class="message-icon">${icons.spark}</div><div><p>Welcome, <strong>${esc(emp.name.split(' ')[0])}</strong>. I’m your onboarding companion for ${esc(repo.organization.name)}.</p><p>You’re currently in <strong>${onboardingStage(emp)}</strong>. I can use your company’s approved knowledge, your onboarding tasks and your employee context to help you decide what to do next.</p>${ui.documents.length?'<p>What would you like to start with?</p>':'<p><strong>Your company has not uploaded knowledge yet.</strong> I can still guide your onboarding tasks, but I will not invent company-specific policies or culture.</p>'}</div></div>`;
  return ui.messages.map(m=>`<div class="message ${m.role==='user'?'user':'agent'}">${m.role==='assistant'?`<div class="message-icon">${icons.spark}</div>`:''}<div><p>${md(m.content)}</p>${m.sources?.length?`<div class="sources"><span>Sources</span>${m.sources.map(s=>`<span class="source-chip">${esc(s.fileName)}</span>`).join('')}</div>`:''}</div></div>`).join('');
}

function billingPage() {
  const active=ui.employees.filter(e=>e.status==='active').length; const paid=Number(repo.subscription?.paid_seats??repo.subscription?.paidSeats??0); const limit=3+paid;
  return `<section class="billing-hero"><div><span class="eyebrow">Simple seat model</span><h2>Start with three active onboarding employees free.</h2><p>From employee #4 onward, a paid seat is required. Pending or archived employees do not need to consume a paid active seat in the intended billing model.</p></div><div class="price-card"><span>Additional active seat</span><strong>${CONFIG.pricePerAdditionalSeatInr?`₹${CONFIG.pricePerAdditionalSeatInr}`:'Set price'}</strong><small>${CONFIG.pricePerAdditionalSeatInr?'/ employee / month':'in config.js before launch'}</small></div></section><section class="two-col"><div class="panel plan-card"><span class="plan-name">STARTER</span><h3>Current plan</h3><div class="meter"><span style="width:${Math.min(100,active/Math.max(limit,1)*100)}%"></span></div><div class="seat-numbers"><strong>${active}</strong><span>active of ${limit} available</span></div><ul><li>3 active employees included free</li><li>Company-isolated knowledge</li><li>Onboarding task tracking</li><li>Local AI option with no per-chat API bill</li></ul><button id="upgradeBtn" class="primary full">Add paid seats</button></div><div class="panel"><span class="eyebrow">Billing readiness</span><h3>Paywall is enforced. Checkout activates when merchant credentials are connected.</h3><div class="check-list"><div class="check ok">✓ <span>Seat limit enforced in UI</span></div><div class="check ok">✓ <span>Seat limit enforced in database schema</span></div><div class="check ${CONFIG.pricePerAdditionalSeatInr?'ok':'pending'}">${CONFIG.pricePerAdditionalSeatInr?'✓':'○'} <span>Per-seat price configured</span></div><div class="check ${CONFIG.razorpayKeyId?'ok':'pending'}">${CONFIG.razorpayKeyId?'✓':'○'} <span>Razorpay public key configured</span></div><div class="check pending">○ <span>Razorpay server secrets + subscription webhook</span></div></div><p class="fineprint">Secrets must never be placed in GitHub or browser code. The server-side hook belongs in a Supabase Edge Function.</p></div></section>`;
}

function render() {
  if (!repo.demo && !repo.user) { root.innerHTML=authScreen(); bind(); return; }
  if (!repo.organization) { root.innerHTML=setupScreen(); bind(); return; }
  let content = ui.page==='home'?overview():ui.page==='knowledge'?knowledgePage():ui.page==='employees'?employeesPage():ui.page==='agent'?agentPage():billingPage();
  root.innerHTML=shell(content); bind();
  const chat=document.querySelector('#chatMessages'); if(chat) chat.scrollTop=chat.scrollHeight;
}

function bind() {
  document.querySelectorAll('[data-nav]').forEach(el=>el.onclick=()=>{ui.page=el.dataset.nav; render();});
  document.querySelector('#setupForm')?.addEventListener('submit', async e=>{e.preventDefault(); const f=new FormData(e.currentTarget); await repo.createOrganization({name:f.get('name'),country:f.get('country'),tone:f.get('tone')}); await refresh(); render();});
  document.querySelectorAll('[data-auth-tab]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('[data-auth-tab]').forEach(x=>x.classList.remove('active'));btn.classList.add('active'); const form=document.querySelector('#authForm'); form.mode.value=btn.dataset.authTab; form.querySelector('button[type=submit]').textContent=btn.dataset.authTab==='signup'?'Create account':'Sign in';});
  document.querySelector('#authForm')?.addEventListener('submit', async e=>{e.preventDefault(); const f=new FormData(e.currentTarget); try{ if(f.get('mode')==='signup'){await repo.signUp(f.get('email'),f.get('password')); document.querySelector('#authHint').textContent='Account created. If email confirmation is enabled, confirm your email and then sign in.';} else {await repo.signIn(f.get('email'),f.get('password')); await refresh(); render();}}catch(err){toast(err.message,'error');}});
  document.querySelector('#signoutBtn')?.addEventListener('click', async()=>{ if(repo.demo){localStorage.removeItem('onboard-ai-demo-v1'); location.reload();} else {await repo.signOut(); render();}});
  document.querySelector('#knowledgeInput')?.addEventListener('change', handleFiles);
  document.querySelector('#employeeForm')?.addEventListener('submit', handleEmployee);
  document.querySelectorAll('[data-employee]').forEach(btn=>btn.onclick=async()=>{ui.selectedEmployee=ui.employees.find(e=>e.id===btn.dataset.employee); [ui.tasks,ui.messages]=await Promise.all([repo.tasks(ui.selectedEmployee.id),repo.messages(ui.selectedEmployee.id)]); render();});
  document.querySelector('#employeeSelect')?.addEventListener('change', async e=>{ui.selectedEmployee=ui.employees.find(x=>x.id===e.target.value); [ui.tasks,ui.messages]=await Promise.all([repo.tasks(ui.selectedEmployee.id),repo.messages(ui.selectedEmployee.id)]); render();});
  document.querySelector('#loadAiBtn')?.addEventListener('click', handleLoadAI);
  document.querySelector('#chatForm')?.addEventListener('submit', handleChat);
  document.querySelectorAll('[data-prompt]').forEach(b=>b.onclick=()=>{const ta=document.querySelector('#chatForm textarea');ta.value=b.dataset.prompt;document.querySelector('#chatForm').requestSubmit();});
  document.querySelector('#upgradeBtn')?.addEventListener('click', handleUpgrade);
}

async function handleFiles(e){
  const files=[...e.target.files]; if(!files.length)return; ui.busy=true; toast(`Indexing ${files.length} file${files.length===1?'':'s'}…`);
  for(const file of files){
    try{
      if(file.size>CONFIG.maxDocumentSizeMb*1024*1024) throw new Error(`${file.name} exceeds ${CONFIG.maxDocumentSizeMb} MB.`);
      const text=await extractText(file); if(text.length<40) throw new Error(`${file.name} did not contain enough extractable text.`);
      const id=crypto.randomUUID(); const category=classifyDocument(file.name,text);
      const doc={id,organizationId:repo.organization.id,fileName:file.name,category,createdAt:new Date().toISOString()};
      const chunks=chunkText(text,{documentId:id,organizationId:repo.organization.id,fileName:file.name,category,maxChunks:CONFIG.maxKnowledgeChunksPerDocument});
      await repo.addKnowledge(file,doc,chunks);
    }catch(err){toast(err.message,'error');}
  }
  await refresh(); ui.busy=false; toast('Knowledge indexed and ready for the agent.'); render();
}

async function handleEmployee(e){ e.preventDefault(); const f=new FormData(e.currentTarget); try{ const emp=await repo.addEmployee(Object.fromEntries(f.entries())); await refresh(); ui.selectedEmployee=ui.employees.find(x=>x.id===emp.id)||emp; ui.tasks=await repo.tasks(ui.selectedEmployee.id); toast(`${emp.name} added to onboarding.`); render(); }catch(err){ if(err.code==='SEAT_LIMIT_REACHED'||err.message==='SEAT_LIMIT_REACHED'){ui.page='billing';toast('Three free active seats are already in use. Add a paid seat to continue.','error');render();}else toast(err.message,'error');}}

async function handleLoadAI(){ const btn=document.querySelector('#loadAiBtn'); const progress=document.querySelector('#modelProgress'); btn.disabled=true; btn.textContent='Loading model…'; try{await loadLocalAI(p=>{if(progress) progress.textContent=p.text||`Loading ${(p.progress*100||0).toFixed(0)}%`;}); toast('Local AI is ready. Agent planning now uses the browser LLM.'); render();}catch(err){toast(err.message,'error');btn.disabled=false;btn.textContent='Load local AI';}}

async function handleChat(e){ e.preventDefault(); if(ui.busy)return; const ta=e.currentTarget.message; const message=ta.value.trim(); if(!message)return; ta.value=''; const emp=ui.selectedEmployee; const userMsg={role:'user',content:message,createdAt:new Date().toISOString()}; ui.messages.push(userMsg); await repo.addMessage(emp.id,userMsg); ui.busy=true; render(); try{ const result=await runAgent({message,employee:emp,tasks:ui.tasks,chunks:ui.chunks,history:ui.messages.slice(0,-1),completeTask:(id)=>repo.completeTask(id)}); const assistant={role:'assistant',content:result.response,sources:result.sources,createdAt:new Date().toISOString()}; ui.messages.push(assistant); await repo.addMessage(emp.id,assistant); ui.tasks=await repo.tasks(emp.id); }catch(err){ui.messages.push({role:'assistant',content:`I hit a problem while working on that: ${err.message}`,sources:[]});} finally{ui.busy=false;render();}}

async function handleUpgrade(){ try{await startUpgrade({organizationId:repo.organization.id,requestedPaidSeats:1});}catch(err){if(err.code==='BILLING_NOT_CONFIGURED')toast('Paywall is ready; choose your price and connect Razorpay credentials to activate checkout.','error');else toast('Billing server hook still needs to be deployed with your merchant credentials.','error');}}

(async function boot(){ await repo.init(); await refresh(); if (!repo.demo && repo.membership?.role === "employee") ui.page = "agent"; render(); })();
