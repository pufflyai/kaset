import { createAgent, createLLMTask, type Tool } from "@pstdio/tiny-ai-tasks";
import { type RequestApproval } from "./approval";
import { systemPrompt as defaultSystemPrompt } from "./prompts";
import { createOpfsTools } from "./tools/createOpfsTools";

export type CreateKasAgentOptions = {
  model: string;
  apiKey: string;
  workspaceDir: string;
  baseURL?: string;
  requestApproval?: RequestApproval;
  approvalGatedTools?: readonly string[];
  systemPrompt?: string;
  effort?: "low" | "medium" | "high";
  maxTurns?: number;
  onShellChunk?: (chunk: string) => void;
  dangerouslyAllowBrowser?: boolean;
  extraTools?: Tool[];
};

export function createKasAgent(opts: CreateKasAgentOptions) {
  if (!opts.apiKey) throw new Error("Missing OpenAI API key");
  if (!opts.model) throw new Error("Missing model");
  if (!opts.workspaceDir) throw new Error("Missing workspaceDir");

  const llm = createLLMTask({
    model: opts.model,
    apiKey: opts.apiKey,
    reasoning: { effort: opts.effort ?? "low" },
    ...(opts.baseURL ? { baseUrl: opts.baseURL } : {}),
    dangerouslyAllowBrowser: opts.dangerouslyAllowBrowser ?? true,
  });

  const tools = [
    ...createOpfsTools({
      workspaceDir: opts.workspaceDir,
      onShellChunk: opts.onShellChunk,
      requestApproval: opts.requestApproval,
      approvalGatedTools: opts.approvalGatedTools as string[] | undefined,
    }),
    ...(opts.extraTools ?? []),
  ];

  return createAgent({
    template: [{ role: "system", content: opts.systemPrompt ?? defaultSystemPrompt }],
    llm,
    tools,
    maxTurns: opts.maxTurns ?? 100,
  });
}
