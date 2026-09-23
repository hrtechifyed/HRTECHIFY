import { searchKnowledge } from "./knowledge.js";
import { complete, localAIStatus } from "./local-llm.js";

function daysSince(dateString) {
  if (!dateString) return 0;
  const start = new Date(`${dateString}T00:00:00`);
  const now = new Date();
  return Math.max(0, Math.floor((now - start) / 86400000));
}

export function onboardingStage(employee) {
  const d = daysSince(employee.joiningDate);
  if (d <= 0) return "Day 1";
  if (d <= 7) return "Week 1";
  if (d <= 30) return "First 30 days";
  if (d <= 60) return "30–60 days";
  return "60–90 days";
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function findTaskToComplete(message, tasks) {
  const m = normalize(message);
  if (!/(done|completed|finished|already did|have done)/.test(m)) return null;
  let best = null;
  let score = 0;
  for (const task of tasks.filter((t) => t.status === "open")) {
    const words = normalize(task.title).split(" ").filter((w) => w.length > 3);
    const s = words.filter((w) => m.includes(w)).length;
    if (s > score) { score = s; best = task; }
  }
  return score ? best : null;
}

function heuristicPlan(message, tasks, chunks) {
  const m = normalize(message);
  const actions = [];
  const completed = findTaskToComplete(message, tasks);
  if (completed) actions.push({ tool: "complete_task", args: { taskId: completed.id } });
  if (/(what.*do|today|next|priority|focus|onboarding|pending|task)/.test(m)) actions.push({ tool: "get_open_tasks", args: {} });
  if (/(manager|team|policy|leave|benefit|culture|company|process|hybrid|remote|travel|expense|it|laptop|security|who|what|how|where|when)/.test(m) || !actions.length) {
    if (chunks.length) actions.push({ tool: "search_knowledge", args: { query: message } });
  }
  if (!actions.length) actions.push({ tool: "get_employee_context", args: {} });
  return { intent: "heuristic", actions: actions.slice(0, 3) };
}

async function llmPlan(message, employee, tasks) {
  const plannerSystem = `You are the planning layer of an employee onboarding agent. You do not answer the employee directly.
Choose zero to three tools that help the employee progress through onboarding.
Available tools:
- get_employee_context {}
- get_open_tasks {}
- search_knowledge {"query":"..."}
- complete_task {"taskId":"..."} ONLY if the employee explicitly says a named task is completed.
Return strict JSON only: {"intent":"...","actions":[{"tool":"...","args":{}}]}
Never invent a task id. Open tasks: ${tasks.filter(t=>t.status==='open').map(t=>`${t.id}: ${t.title}`).join(" | ") || "none"}.
Employee: ${employee.name}, role ${employee.roleTitle || "not provided"}, team ${employee.teamName || "not provided"}.`;
  const raw = await complete([
    { role: "system", content: plannerSystem },
    { role: "user", content: message },
  ], { temperature: 0.05, maxTokens: 260, responseFormat: { type: "json_object" } });
  try {
    const parsed = JSON.parse(raw);
    return { intent: parsed.intent || "unknown", actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [] };
  } catch {
    return null;
  }
}

async function executeTools(plan, { employee, tasks, chunks, completeTask }) {
  const results = [];
  for (const action of plan.actions || []) {
    if (action.tool === "get_employee_context") {
      results.push({ tool: action.tool, data: { ...employee, onboardingStage: onboardingStage(employee) } });
    }
    if (action.tool === "get_open_tasks") {
      results.push({ tool: action.tool, data: tasks.filter((t) => t.status === "open") });
    }
    if (action.tool === "search_knowledge") {
      results.push({ tool: action.tool, data: searchKnowledge(action.args?.query || "", chunks, 5) });
    }
    if (action.tool === "complete_task") {
      const task = tasks.find((t) => t.id === action.args?.taskId && t.status === "open");
      if (task) {
        await completeTask(task.id);
        task.status = "completed";
        results.push({ tool: action.tool, data: { success: true, task } });
      }
    }
  }
  return results;
}

function sourceList(toolResults) {
  const map = new Map();
  toolResults.filter(r => r.tool === "search_knowledge").flatMap(r => r.data || []).forEach(c => {
    if (!map.has(c.documentId)) map.set(c.documentId, { documentId: c.documentId, fileName: c.fileName, category: c.category });
  });
  return [...map.values()].slice(0, 4);
}

function fallbackResponse(message, employee, tasks, results) {
  const stage = onboardingStage(employee);
  const open = tasks.filter((t) => t.status === "open");
  const knowledge = results.filter(r => r.tool === "search_knowledge").flatMap(r => r.data || []);
  const completed = results.find(r => r.tool === "complete_task" && r.data?.success);
  if (completed) {
    return `Done — I’ve marked **${completed.data.task.title}** as completed. You have ${open.length} open onboarding item${open.length === 1 ? "" : "s"} remaining.`;
  }
  if (knowledge.length) {
    const best = knowledge[0];
    const excerpt = best.content.length > 650 ? `${best.content.slice(0, 650).trim()}…` : best.content;
    return `Here’s what I found in your company’s approved onboarding knowledge:

${excerpt}

I’m grounding this answer in **${best.fileName}** rather than making a company-specific assumption.`;
  }
  if (/(what|today|next|focus|priority|task|onboarding)/i.test(message) && open.length) {
    const next = [...open].sort((a,b)=>(a.dueOffsetDays||0)-(b.dueOffsetDays||0)).slice(0,3);
    return `You’re currently in **${stage}**. I’d focus on these next:

${next.map((t,i)=>`${i+1}. **${t.title}** — ${t.description}`).join("\n")}

You can tell me when you complete one and I’ll update your onboarding progress.`;
  }
  return `You’re in **${stage}** of onboarding. I don’t have enough approved company knowledge to answer that reliably yet. Ask your company admin to upload the relevant policy, process, team or manager information rather than relying on a generic answer.`;
}

async function llmResponse(message, employee, tasks, toolResults, history) {
  const safeResults = toolResults.map((r) => ({ tool: r.tool, data: r.data }));
  const system = `You are a warm, concise Employee Onboarding Agent. Your goal is to help the employee successfully onboard, not merely answer questions.
Use ONLY supplied tool results for company-specific facts. Never invent policy, benefits, culture, manager or process information.
Answer the immediate question first, then suggest one useful next step when appropriate.
If knowledge is missing, say so clearly.
Do not reveal internal tool planning.
Employee: ${employee.name}; role: ${employee.roleTitle || "not provided"}; team: ${employee.teamName || "not provided"}; manager: ${employee.managerName || "not provided"}; location: ${employee.location || "not provided"}; stage: ${onboardingStage(employee)}.
Tool results: ${JSON.stringify(safeResults).slice(0, 9000)}`;
  const recent = (history || []).slice(-6).map((m) => ({ role: m.role, content: m.content }));
  return complete([
    { role: "system", content: system },
    ...recent,
    { role: "user", content: message },
  ], { temperature: 0.25, maxTokens: 560 });
}

export async function runAgent({ message, employee, tasks, chunks, history = [], completeTask }) {
  let plan = null;
  if (localAIStatus().ready) {
    try { plan = await llmPlan(message, employee, tasks); } catch { plan = null; }
  }
  if (!plan || !Array.isArray(plan.actions)) plan = heuristicPlan(message, tasks, chunks);

  const toolResults = await executeTools(plan, { employee, tasks, chunks, completeTask });
  let response;
  if (localAIStatus().ready) {
    try { response = await llmResponse(message, employee, tasks, toolResults, history); }
    catch { response = fallbackResponse(message, employee, tasks, toolResults); }
  } else {
    response = fallbackResponse(message, employee, tasks, toolResults);
  }
  return { response, sources: sourceList(toolResults), plan: { intent: plan.intent, toolsUsed: (plan.actions || []).map(a => a.tool) } };
}
