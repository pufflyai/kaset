import { createAgent, type Model, type Tool } from "@pstdio/tiny-ai-tasks";
import { systemPrompt as defaultSystemPrompt } from "./prompts";

export type CreateKasAgentOptions = {
  /** The model the agent runs on, built with `openaiModel(...)` or `webLLMModel(...)`. */
  model: Model;
  systemPrompt?: string;
  tools?: Tool[];
  maxTurns?: number;
};

export function createKasAgent(opts: CreateKasAgentOptions): ReturnType<typeof createAgent> {
  if (!opts.model) throw new Error("Missing model");

  return createAgent({
    template: [{ role: "system", content: opts.systemPrompt ?? defaultSystemPrompt }],
    llm: opts.model,
    tools: opts.tools ?? [],
    maxTurns: opts.maxTurns ?? 100,
  });
}
