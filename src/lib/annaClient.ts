import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";
import type { BizPilotState } from "../types";

export const TOOL_ID = "tool-leprof-bizpilot-ai-tools-a9tswjax";
const STORAGE_KEY = "bizpilot-ai:workspace-state:v1";

interface AnnaRuntimeInstance {
  theme?: "light" | "dark";
  onThemeChange?: (cb: (payload: { theme: "light" | "dark" }) => void) => void;
  window: {
    set_title: (args: { title: string }) => Promise<unknown>;
    report_error?: (args: { message: string }) => Promise<unknown>;
  };
  tools: {
    invoke: (args: {
      tool_id: string;
      method: string;
      args: Record<string, unknown>;
    }) => Promise<{ success: boolean; data?: unknown; error?: string }>;
  };
  storage: {
    get: (args: { key: string }) => Promise<{ value?: unknown } | unknown>;
    set: (args: { key: string; value: unknown }) => Promise<unknown>;
  };
  llm: {
    complete: (args: {
      systemPrompt?: string;
      messages: Array<{ role: "user" | "assistant"; content: { type: "text"; text: string } }>;
      temperature?: number;
      maxTokens?: number;
    }) => Promise<unknown>;
  };
}

export class AnnaRuntimeUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnaRuntimeUnavailableError";
  }
}

export async function connectToAnna(): Promise<AnnaRuntimeInstance> {
  let runtime: AnnaRuntimeInstance;
  try {
    runtime = (await AnnaAppRuntime.connect()) as AnnaRuntimeInstance;
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unable to connect to Anna AI OS host.";
    throw new AnnaRuntimeUnavailableError(detail);
  }

  if (runtime.theme) {
    document.documentElement.dataset.theme = runtime.theme;
  }
  runtime.onThemeChange?.(({ theme }) => {
    document.documentElement.dataset.theme = theme;
  });

  try {
    await runtime.window.set_title({ title: "BizPilot AI" });
  } catch {
    // Non-fatal window title sync
  }

  return runtime;
}

export async function invokeExecuta<T>(
  anna: AnnaRuntimeInstance,
  method: string,
  args: Record<string, unknown>
): Promise<T> {
  const res = await anna.tools.invoke({
    tool_id: TOOL_ID,
    method,
    args,
  });

  if (!res || typeof res !== "object") {
    throw new Error(`Executa '${method}' returned an invalid response.`);
  }
  const obj = res as Record<string, unknown>;
  if ("success" in obj) {
    if (!obj.success) {
      const errMsg = typeof obj.error === "string" && obj.error ? obj.error : `Executa '${method}' failed.`;
      throw new Error(errMsg);
    }
    return obj.data as T;
  }
  return res as T;
}

export async function loadWorkspaceState(anna: AnnaRuntimeInstance): Promise<BizPilotState> {
  const raw = await anna.storage.get({ key: STORAGE_KEY });
  const value =
    raw && typeof raw === "object" && "value" in raw
      ? (raw as { value?: unknown }).value
      : raw;

  if (!value || typeof value !== "object") {
    return { profile: null, documents: [], orders: [] };
  }

  const parsed = value as Partial<BizPilotState>;
  return {
    profile: parsed.profile ?? null,
    documents: Array.isArray(parsed.documents) ? parsed.documents : [],
    orders: Array.isArray(parsed.orders) ? parsed.orders : [],
  };
}

export async function saveWorkspaceState(
  anna: AnnaRuntimeInstance,
  state: BizPilotState
): Promise<void> {
  await anna.storage.set({
    key: STORAGE_KEY,
    value: state,
  });
}

function extractTextFromLlmResponse(response: unknown): string {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") {
    throw new Error("LLM returned an empty response.");
  }
  const obj = response as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.content === "string") return obj.content;
  if (Array.isArray(obj.content)) {
    const textPart = obj.content.find(
      (part) => part && typeof part === "object" && (part as Record<string, unknown>).type === "text"
    ) as Record<string, unknown> | undefined;
    if (textPart && typeof textPart.text === "string") return textPart.text;
  }
  throw new Error("Unexpected LLM response format from Anna AI OS.");
}

export async function completeWithAnnaJson<T>(
  anna: AnnaRuntimeInstance,
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const raw = await anna.llm.complete({
    systemPrompt,
    messages: [{ role: "user", content: { type: "text", text: userPrompt } }],
    temperature: 0.2,
    maxTokens: 1200,
  });

  const text = extractTextFromLlmResponse(raw).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : text;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    throw new Error("AI response could not be parsed as structured JSON. Please retry.");
  }
}

export async function completeWithAnnaText(
  anna: AnnaRuntimeInstance,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const raw = await anna.llm.complete({
    systemPrompt,
    messages: [{ role: "user", content: { type: "text", text: userPrompt } }],
    temperature: 0.3,
    maxTokens: 800,
  });
  return extractTextFromLlmResponse(raw).trim();
}

export type { AnnaRuntimeInstance };
