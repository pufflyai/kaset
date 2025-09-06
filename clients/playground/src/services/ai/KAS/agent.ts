import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { createAgent, createLLMTask } from "@pstdio/tiny-ai-tasks";
import { requestApproval } from "./approval";
import { systemPrompt } from "./prompts";
import { createOpfsTools } from "./tools/createOpfsTools";

export function getAgent() {
  const state = useWorkspaceStore.getState();
  const model = state.modelId;
  const apiKey = state.apiKey;
  const baseUrl = state.baseUrl;

  if (!apiKey) {
    throw new Error("Missing OpenAI API key. Set it in Settings.");
  }

  const llm = createLLMTask({
    model,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    dangerouslyAllowBrowser: true,
  });

  const tools = createOpfsTools({
    workspaceDir: `${state.selectedProjectId || "todo"}`,
    onShellChunk: (s) => console.debug("opfs_shell:", s),
    requestApproval,
  });

  return createAgent({
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
}
