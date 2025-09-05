import { createAgent, createLLMTask } from "@pstdio/tiny-ai-tasks";
import { requestApproval } from "./approval";
import { systemPrompt } from "./prompts";
import { createOpfsTools } from "./tools/createOpfsTools";

const model = window.localStorage.getItem("tiny-ai-model") || "gpt-4.1-mini";
const apiKey = window.localStorage.getItem("tiny-ai-api-key");
const baseUrl = window.localStorage.getItem("tiny-ai-base-url");

const llm = createLLMTask({
  model,
  ...(apiKey ? { apiKey } : {}),
  ...(baseUrl ? { baseUrl } : {}),
  dangerouslyAllowBrowser: true,
});

const tools = createOpfsTools({
  workspaceDir: "playground",
  onShellChunk: (s) => console.debug("opfs_shell:", s),
  requestApproval,
});

export const agent = createAgent({
  template: [
    {
      role: "system",
      content: systemPrompt,
    },
  ],
  llm,
  tools,
  maxTurns: 100,
});
