const STOPWORDS = new Set("the a an and or but if then than of to in on for with at by from as is are was were be been being it this that these those you your we our they their i me my can could should would will may might about into through during how what when where who which company employee employees policy policies process team manager work working".split(" "));

function clean(text) {
  return text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractText(file) {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (["txt", "md", "csv"].includes(ext)) return clean(await file.text());

  if (ext === "docx") {
    if (!window.mammoth) throw new Error("DOCX parser did not load. Refresh and try again.");
    const result = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return clean(result.value);
  }

  if (ext === "pdf") {
    const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return clean(pages.join("\n\n"));
  }

  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, MD or CSV.");
}

export function classifyDocument(fileName, text) {
  const sample = `${fileName} ${text.slice(0, 2500)}`.toLowerCase();
  const rules = [
    ["Benefits", ["benefit", "insurance", "medical", "wellness", "gratuity", "provident fund"]],
    ["IT & Security", ["information security", "cyber", "laptop", "it support", "system access", "password"]],
    ["Culture & Values", ["culture", "values", "behaviour", "behavior", "principles", "ways of working"]],
    ["HR Policy", ["leave", "holiday", "attendance", "travel policy", "expense", "working hours", "hybrid"]],
    ["Team & Role", ["team", "manager", "organisation chart", "organization chart", "role description", "stakeholder"]],
    ["Company", ["about us", "company overview", "strategy", "history", "purpose", "mission", "vision"]],
  ];
  for (const [category, terms] of rules) if (terms.some((t) => sample.includes(t))) return category;
  return "General";
}

export function chunkText(text, { documentId, organizationId, fileName, category, maxChunks = 240 }) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  const target = 1200;
  const overlap = 180;

  const push = () => {
    if (!current.trim() || chunks.length >= maxChunks) return;
    chunks.push({
      id: crypto.randomUUID(),
      organizationId,
      documentId,
      fileName,
      category,
      chunkIndex: chunks.length,
      content: current.trim(),
    });
  };

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= target) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      push();
      const tail = current.slice(-overlap);
      current = `${tail}\n\n${paragraph}`;
    }
    if (chunks.length >= maxChunks) break;
  }
  push();
  return chunks;
}

function tokens(text) {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{1,}/g)?.filter((w) => !STOPWORDS.has(w)) || [];
}

export function searchKnowledge(query, chunks, limit = 5) {
  const q = tokens(query);
  if (!q.length) return [];
  const qSet = new Set(q);
  return chunks
    .map((chunk) => {
      const body = chunk.content.toLowerCase();
      let score = 0;
      qSet.forEach((term) => {
        const hits = body.split(term).length - 1;
        if (hits) score += 2 + Math.min(hits, 4);
        if (chunk.fileName?.toLowerCase().includes(term)) score += 2;
        if (chunk.category?.toLowerCase().includes(term)) score += 1;
      });
      const phrase = query.toLowerCase().trim();
      if (phrase.length > 10 && body.includes(phrase)) score += 10;
      return { ...chunk, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
