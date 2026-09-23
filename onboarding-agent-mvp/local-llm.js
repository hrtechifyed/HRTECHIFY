import { CONFIG } from "./config.js";

let engine = null;
let status = "idle";

export function localAIStatus() {
  return { status, ready: Boolean(engine) };
}

export async function loadLocalAI(onProgress = () => {}) {
  if (engine) return engine;
  if (!navigator.gpu) throw new Error("This browser/device does not expose WebGPU. The agent will continue in smart rules mode.");
  status = "loading";
  const webllm = await import("https://esm.run/@mlc-ai/web-llm@0.2.85");
  engine = await webllm.CreateMLCEngine(CONFIG.localModelId, {
    initProgressCallback: (p) => onProgress(p),
  });
  status = "ready";
  return engine;
}

export async function complete(messages, options = {}) {
  if (!engine) throw new Error("LOCAL_AI_NOT_READY");
  const response = await engine.chat.completions.create({
    messages,
    temperature: options.temperature ?? 0.25,
    max_tokens: options.maxTokens ?? 550,
    ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
  });
  return response.choices?.[0]?.message?.content || "";
}
