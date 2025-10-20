import { createAgent, createLLMTask, type Tool } from "@pstdio/tiny-ai-tasks";
import { systemPrompt as defaultSystemPrompt } from "./prompts";

export type CreateKasAgentOptions = {
  model: string;
  apiKey?: string;
  baseURL?: string;
  systemPrompt?: string;
  tools?: Tool[];
  reasoning?: {
    effort: "low" | "medium" | "high";
  };
  maxTurns?: number;
  dangerouslyAllowBrowser?: boolean;
};

export function createKasAgent(opts: CreateKasAgentOptions) {
  if (!opts.model) throw new Error("Missing model");

  if (!opts.apiKey && !opts.baseURL) {
    throw new Error("Missing API key. Provide an API key or configure a Base URL.");
  }

  const llm = createLLMTask({
    model: opts.model,
    ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
    ...(opts.reasoning ? { reasoning: opts.reasoning } : {}),
    ...(opts.baseURL ? { baseUrl: opts.baseURL } : {}),
    ...(opts.dangerouslyAllowBrowser ? { dangerouslyAllowBrowser: opts.dangerouslyAllowBrowser } : {}),
  });

  const tools = opts.tools ?? [];

  return createAgent({
    template: [{ role: "system", content: opts.systemPrompt ?? defaultSystemPrompt }],
    llm,
    tools,
    maxTurns: opts.maxTurns ?? 100,
  });
}
