import { ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { createApprovalGate, createKasAgent } from "@pstdio/kas";
import {
  decorateWithThought,
  toBaseMessages,
  toConversationUI,
  withClosedThoughts,
  type UIConversation,
} from "@pstdio/kas-ui";
import { createOpfsTools, loadAgentInstructions } from "@pstdio/kas/opfs-tools";
import { safeAutoCommit } from "@pstdio/opfs-utils";
import { type Tool } from "@pstdio/tiny-ai-tasks";
import { desktopTools } from "../desktop/tools";
import { requestApproval } from "./approval";

const rootDir = ROOT;

export async function* sendMessage(_conversationId: string, messages: UIConversation, extraTools: Tool[] = []) {
  const { settings } = useWorkspaceStore.getState();
  const approvalGatedTools = settings.approvalGatedTools ?? [];
  const apiKey = settings.apiKey;
  const baseUrl = settings.baseUrl;
  const modelId = settings.modelId ?? "gpt-5";

  const approvalGate = createApprovalGate({ approvalGatedTools, requestApproval });

  // load agents.md file
  const agentInstructions = await loadAgentInstructions(rootDir);

  const OPFSTools = createOpfsTools({ rootDir, approvalGate });

  const tools: Tool<any, any>[] = [...OPFSTools, ...desktopTools, ...extraTools];

  const agent = createKasAgent({
    model: modelId,
    tools,
    apiKey: apiKey ?? "PLACEHOLDER_KEY",
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    dangerouslyAllowBrowser: true,
  });

  const { messages: initialUIMessages, thought } = decorateWithThought(messages);

  yield initialUIMessages;

  const agentHistory = [...agentInstructions.messages, ...toBaseMessages(messages)];

  for await (const ui of toConversationUI(agent(agentHistory))) {
    const next = withClosedThoughts([...initialUIMessages, ...ui], thought);
    yield next;
  }

  await safeAutoCommit({
    dir: rootDir,
    message: "AI updates",
    author: { name: "KAS", email: "kas@kaset.dev" },
  });
}
