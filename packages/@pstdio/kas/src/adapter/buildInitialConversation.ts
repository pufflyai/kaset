import { readFile } from "@pstdio/opfs-utils";
import { shortUID } from "@pstdio/prompt-utils";
import { type BaseMessage, type ExtendedMessage, filterHistory, toBaseMessages } from "@pstdio/tiny-ai-tasks";
import { Message, UIConversation } from "./types";
import { getLastUserText, toMessageHistory } from "./utils";

export async function buildInitialConversation(conversation: UIConversation, path: string) {
  let uiMessages: UIConversation = [...conversation];

  // Insert hidden dev "thinking" note visible in the UI, not in LLM prompt
  const thoughtId = shortUID();
  const thoughtStart = Date.now();
  const developerThinking: Message = {
    id: thoughtId,
    role: "developer",
    meta: { hidden: true, tags: ["thinking"] },
    parts: [{ type: "reasoning", text: "Thinking...", state: "streaming" }],
  } as Message;

  uiMessages = [...uiMessages, developerThinking];

  // Early exit if no user text (parity with original)
  const userText = getLastUserText(uiMessages);
  if (!userText) {
    return {
      initialForAgent: [] as BaseMessage[],
      uiBoot: uiMessages,
      devNote: { id: thoughtId, startedAt: thoughtStart },
    };
  }

  // Build LLM-visible history (filter out hidden)
  const baseFromUI = toMessageHistory(uiMessages);
  const extendedFromUI: ExtendedMessage[] = baseFromUI.map((m) => ({ ...m }));

  // Inject agents.md if present on every turn
  const pathsToTry = [`${path}/agents.md`, `${path}/AGENTS.md`];

  for (const p of pathsToTry) {
    try {
      const content = await readFile(p);
      if (content && content.trim().length > 0) {
        extendedFromUI.unshift({ role: "system", content } as ExtendedMessage);
        break;
      }
    } catch {
      // ignore
    }
  }

  // Also append hidden developer note so filterHistory removes it
  extendedFromUI.push({
    role: "developer",
    content: "Thinking...",
    meta: { hidden: true, tags: ["thinking"] },
  });

  const initialForAgent: BaseMessage[] = toBaseMessages(filterHistory(extendedFromUI, { excludeHidden: true }));

  return {
    initialForAgent,
    uiBoot: uiMessages,
    devNote: { id: thoughtId, startedAt: thoughtStart },
  };
}
