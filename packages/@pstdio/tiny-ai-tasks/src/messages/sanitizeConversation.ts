import type { BaseMessage } from "../utils/messageTypes";

/**
 * Providers like Anthropic restrict requests to a single system prompt.
 * Normalize conversations by merging every system message into a single
 * message placed at the beginning of the history. Non-system messages keep
 * their relative ordering.
 */
export function sanitizeConversation(messages: BaseMessage[]): BaseMessage[] {
  const systemMessages: BaseMessage[] = [];
  const rest: BaseMessage[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      systemMessages.push(message);
      continue;
    }
    rest.push(message);
  }

  if (!systemMessages.length) return messages;

  const systemContent = systemMessages
    .map((message) => (typeof message.content === "string" ? message.content : ""))
    .filter((content) => content.length > 0);

  const mergedSystemMessage: BaseMessage = {
    role: "system",
    content: systemContent.length ? systemContent.join("\n\n") : "",
  };

  return [mergedSystemMessage, ...rest];
}
