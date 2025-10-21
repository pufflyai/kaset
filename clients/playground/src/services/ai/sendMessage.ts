import { ROOT } from "@/constant";
import { createApprovalGate, createKasAgent } from "@pstdio/kas";
import type { UIConversation } from "@pstdio/kas/kas-ui";
import { decorateWithThought, toBaseMessages, toConversationUI, withClosedThoughts } from "@pstdio/kas/kas-ui";
import { createOpfsTools, loadAgentInstructions } from "@pstdio/kas/opfs-tools";
import { safeAutoCommit } from "@pstdio/opfs-utils";
import { type Tool } from "@pstdio/tiny-ai-tasks";
import { desktopTools } from "../desktop/tools";
import { requestApproval } from "./approval";

const rootDir = ROOT;

interface SendMessageOptions {
  tools?: Tool[];
  chatSettings: {
    modelId: string | null;
    apiKey?: string;
    baseUrl?: string;
    approvalGatedTools?: string[];
  };
}

export async function* sendMessage(_conversationId: string, messages: UIConversation, options: SendMessageOptions) {
  const { tools: extraTools = [], chatSettings } = options;
  const { modelId, approvalGatedTools = [], apiKey, baseUrl } = chatSettings;

  const approvalGate = createApprovalGate({ approvalGatedTools, requestApproval });

  // load agents.md file
  const agentInstructions = await loadAgentInstructions(rootDir);

  const OPFSTools = createOpfsTools({ rootDir, approvalGate });

  const tools: Tool<any, any>[] = [...OPFSTools, ...desktopTools, ...extraTools];

  const agent = createKasAgent({
    model: modelId ?? "gpt-5",
    tools,
    apiKey: apiKey ?? "PLACEHOLDER_KEY",
    ...(baseUrl ? { baseURL: baseUrl } : {}),
    dangerouslyAllowBrowser: true,
  });

  const initialMessages = [...agentInstructions.messages, ...messages];

  const { messages: initialUIMessages, thought } = decorateWithThought(messages);

  yield initialUIMessages;

  for await (const ui of toConversationUI(agent(toBaseMessages(initialMessages)))) {
    const next = withClosedThoughts([...initialUIMessages, ...ui], thought);
    yield next;
  }

  await safeAutoCommit({
    dir: rootDir,
    message: "AI updates",
    author: { name: "KAS", email: "kas@kaset.dev" },
  });
}
