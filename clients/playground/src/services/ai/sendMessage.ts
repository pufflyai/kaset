import { PROJECTS_ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { UIConversation } from "@/types";
import { buildInitialConversation, createKasAgent, toConversation } from "@pstdio/kas";
import { safeAutoCommit } from "@pstdio/opfs-utils";
import { requestApproval } from "./approval";

export async function* sendMessage(conversationId: string, conversation: UIConversation) {
  const projectId = useWorkspaceStore.getState().selectedProjectId;
  const dir = `/${PROJECTS_ROOT}/${projectId}`;

  const sessionId = conversationId;

  const { initialForAgent, uiBoot, devNote } = await buildInitialConversation(conversation, dir);

  const modelId = useWorkspaceStore.getState().modelId;
  const apiKey = useWorkspaceStore.getState().apiKey!;
  const baseURL = useWorkspaceStore.getState().baseUrl;
  const approvalGatedTools = useWorkspaceStore.getState().approvalGatedTools;

  const agent = createKasAgent({
    model: modelId,
    apiKey,
    baseURL,
    workspaceDir: dir,
    approvalGatedTools,
    requestApproval,
  });

  for await (const ui of toConversation(agent(initialForAgent, { sessionId }), { boot: uiBoot, devNote })) {
    yield ui;
  }

  await safeAutoCommit({
    dir,
    message: "AI updates",
    author: { name: "KAS", email: "kas@kaset.dev" },
  });
}
