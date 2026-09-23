const KEY = "onboard-ai-demo-v1";

const defaultTasks = [
  ["Meet your manager", "Have your first manager conversation and align on immediate priorities.", 0],
  ["Confirm IT and system access", "Check that your laptop, core systems, email and required access are working.", 0],
  ["Understand your team", "Learn the team purpose, structure, key roles and ways of working.", 3],
  ["Review essential policies", "Review the policies and processes most relevant to your role and location.", 5],
  ["Meet key stakeholders", "Identify and connect with the people you will work with most often.", 10],
  ["Discuss role expectations", "Align with your manager on outcomes, priorities and what good performance looks like.", 14],
  ["Complete 30-day check-in", "Reflect on progress, remaining questions and support needed for the next phase.", 30],
];

function initialState() {
  return {
    mode: "demo",
    organization: null,
    employees: [],
    documents: [],
    chunks: [],
    tasks: [],
    messages: {},
    subscription: { plan: "free", includedSeats: 3, paidSeats: 0, status: "active" },
  };
}

export function loadDemoState() {
  try {
    return { ...initialState(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return initialState();
  }
}

export function saveDemoState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetDemoState() {
  localStorage.removeItem(KEY);
}

export function createDemoOrganization(state, { name, country, tone }) {
  const organization = {
    id: crypto.randomUUID(),
    name,
    country,
    tone,
    slug: name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    createdAt: new Date().toISOString(),
  };
  state.organization = organization;
  saveDemoState(state);
  return organization;
}

export function addDemoEmployee(state, input) {
  const limit = (state.subscription?.includedSeats ?? 3) + (state.subscription?.paidSeats ?? 0);
  const activeCount = state.employees.filter((e) => e.status === "active").length;
  if ((input.status || "active") === "active" && activeCount >= limit) {
    const error = new Error("SEAT_LIMIT_REACHED");
    error.code = "SEAT_LIMIT_REACHED";
    throw error;
  }

  const employee = {
    id: crypto.randomUUID(),
    organizationId: state.organization.id,
    name: input.name,
    email: input.email,
    roleTitle: input.roleTitle || "",
    teamName: input.teamName || "",
    managerName: input.managerName || "",
    location: input.location || "",
    joiningDate: input.joiningDate || new Date().toISOString().slice(0, 10),
    status: input.status || "active",
    createdAt: new Date().toISOString(),
  };
  state.employees.push(employee);
  defaultTasks.forEach(([title, description, dueOffsetDays]) => {
    state.tasks.push({
      id: crypto.randomUUID(),
      organizationId: state.organization.id,
      employeeId: employee.id,
      title,
      description,
      dueOffsetDays,
      status: "open",
      source: "default",
    });
  });
  saveDemoState(state);
  return employee;
}

export function addDemoDocument(state, document, chunks) {
  state.documents.push(document);
  state.chunks.push(...chunks);
  saveDemoState(state);
}

export function updateDemoTask(state, taskId, status) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) task.status = status;
  saveDemoState(state);
  return task;
}

export function addDemoMessage(state, employeeId, message) {
  if (!state.messages[employeeId]) state.messages[employeeId] = [];
  state.messages[employeeId].push(message);
  if (state.messages[employeeId].length > 60) state.messages[employeeId] = state.messages[employeeId].slice(-60);
  saveDemoState(state);
}
