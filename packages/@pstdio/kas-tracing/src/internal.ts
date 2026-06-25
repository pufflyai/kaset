import type { AssistantMessage, BaseMessage } from "@pstdio/tiny-ai-tasks";

export const noop = () => {};

export function stringifyError(err: unknown) {
  if (err instanceof Error) return err.stack || err.message;
  return String(err);
}

type ModelMessageInput = BaseMessage[] | { messages: BaseMessage[] };

export function extractMessages(input: ModelMessageInput): BaseMessage[] {
  return Array.isArray(input) ? input : input.messages;
}

// LangSmith reads token counts from `usage_metadata` on an llm run, using its own
// field names. Map the OpenAI-style counts our AssistantMessage carries onto those.
export function toUsageMetadata(usage: AssistantMessage["usage"]) {
  if (!usage) return undefined;

  const metadata: Record<string, number> = {};
  if (usage.prompt_tokens != null) metadata.input_tokens = usage.prompt_tokens;
  if (usage.completion_tokens != null) metadata.output_tokens = usage.completion_tokens;
  if (usage.total_tokens != null) metadata.total_tokens = usage.total_tokens;

  return Object.keys(metadata).length ? metadata : undefined;
}
