import { ROOT } from "@/constant";
import { getWorkspaceSettings } from "@/state/actions/getWorkspaceSettings";
import type { UIConversation } from "@/types";
import { buildInitialConversation, createKasAgent, toConversation } from "@pstdio/kas";
import { safeAutoCommit } from "@pstdio/opfs-utils";
import type { Tool } from "@pstdio/tiny-ai-tasks";
import { requestApproval } from "./approval";
import { checkDesktopStateTool } from "../desktop/checkDesktopStateTool";

const directory = ROOT;

export async function* sendMessage(conversationId: string, conversation: UIConversation, extraTools: Tool[] = []) {
  const sessionId = conversationId;

  const { initialForAgent, uiBoot, devNote } = await buildInitialConversation(conversation, directory);

  const { modelId, approvalGatedTools, apiKey, baseUrl } = getWorkspaceSettings();

  const toolsForAgent = [checkDesktopStateTool, ...extraTools];

  const agent = createKasAgent({
    model: modelId,
    workspaceDir: directory,
    approvalGatedTools,
    requestApproval,
    apiKey: apiKey ?? "PLACEHOLDER_KEY",
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    extraTools: toolsForAgent,
  });

  for await (const ui of toConversation(agent(initialForAgent, { sessionId }), { boot: uiBoot, devNote })) {
    yield ui;
  }

  await safeAutoCommit({
    dir: directory,
    message: "AI updates",
    author: { name: "KAS", email: "kas@kaset.dev" },
  });
}
