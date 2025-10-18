import type { AssistantMessage, BaseMessage, MessageContent, ToolMessage } from "@pstdio/tiny-ai-tasks";
import { messageContentToString } from "@pstdio/tiny-ai-tasks";
import type { ToolInvocation, UIConversation, UIMessage } from "./types";

type MutableToolInvocation = ToolInvocation & Record<string, unknown>;

type ToolInvocationRecord = {
  messageIndex: number;
  partIndex: number;
  invocation: MutableToolInvocation;
};

const toTextSegments = (content: MessageContent) => {
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        if (typeof part.text === "string") return part.text.trim();
        if (typeof part.content === "string") return part.content.trim();

        return "";
      })
      .filter(Boolean);
  }

  return [];
};

const toReasoningSegments = (reasoning: unknown) => {
  if (!Array.isArray(reasoning)) return [];

  return reasoning
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      if (typeof entry.text === "string") return entry.text.trim();
      if (typeof entry.content === "string") return entry.content.trim();

      return "";
    })
    .filter(Boolean);
};

const isUIRole = (role: string): role is UIMessage["role"] => {
  return role === "system" || role === "user" || role === "assistant" || role === "developer";
};

const parseJSON = (value: unknown) => {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (Array.isArray(value)) {
    const text = messageContentToString(value as BaseMessage["content"]);

    if (!text) return value;

    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }

  return value;
};

const toUsageMeta = (usage: AssistantMessage["usage"]) => {
  if (!usage) return undefined;

  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  const totalTokens = usage.total_tokens;

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
};

const toToolInvocation = (
  call: NonNullable<AssistantMessage["tool_calls"]>[number],
  fallbackId: string,
  existing?: MutableToolInvocation,
): MutableToolInvocation => {
  const toolCallId = call?.id?.trim() ? call.id : fallbackId;
  const rawName = call?.function?.name?.trim() || call?.type?.trim() || "tool";
  const invocation: MutableToolInvocation = existing ?? {
    type: `tool-${rawName}`,
    toolCallId,
  };

  invocation.toolCallId = toolCallId;
  invocation.type = `tool-${rawName}`;

  const args = call?.function?.arguments;
  const hasFinalState = invocation.state === "output-available" || invocation.state === "output-error";

  if (typeof args === "string") {
    const trimmed = args.trim();

    if (trimmed) {
      invocation.input = parseJSON(args);
      const state = invocation.state as string | undefined;

      if (!hasFinalState && (state === undefined || state === "input-streaming" || state === null)) {
        invocation.state = "input-available";
      }
    } else if (invocation.input === undefined) {
      invocation.input = null;
    }
  } else if (invocation.input === undefined) {
    invocation.input = null;
  }

  return invocation;
};

const toErrorText = (value: unknown) => {
  if (value == null) return "Tool execution failed";
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

function handleToolMessage(
  message: ToolMessage,
  target: UIConversation,
  lookup: Map<string, ToolInvocationRecord>,
  idFactory: () => string,
) {
  const rawId = message.tool_call_id;
  if (rawId == null || rawId === "") return;

  const toolCallId = String(rawId);
  let record = lookup.get(toolCallId);

  if (!record) {
    const candidateName = "name" in message ? (message as { name?: unknown }).name : undefined;
    const toolName =
      typeof candidateName === "string" && candidateName.trim().length > 0 ? candidateName.trim() : toolCallId;
    const invocation: MutableToolInvocation = {
      type: `tool-${toolName}`,
      toolCallId,
    };

    const fallback: UIMessage = {
      id: idFactory(),
      role: "assistant",
      parts: [{ type: "tool-invocation", toolInvocation: invocation }],
    };

    target.push(fallback);

    const messageIndex = target.length - 1;
    record = { messageIndex, partIndex: 0, invocation };
    lookup.set(toolCallId, record);
  }

  const invocation = record.invocation;
  const parsed = parseJSON(message.content);

  invocation.providerExecuted = true;

  if (invocation.input === undefined) invocation.input = null;

  if (parsed && typeof parsed === "object" && parsed.success === false) {
    invocation.state = "output-error";
    invocation.rawInput = parsed;
    invocation.errorText = toErrorText(parsed.error ?? parsed);
    delete invocation.output;
    return;
  }

  const output = parsed && typeof parsed === "object" && "data" in parsed ? parsed.data : parsed;

  invocation.state = "output-available";
  invocation.output = output;
  delete invocation.errorText;
  delete invocation.rawInput;
}

export const toUIMessages = (messages: BaseMessage[]): UIConversation => {
  const conversation: UIConversation = [];
  const toolLookup = new Map<string, ToolInvocationRecord>();

  let messageCounter = 0;
  let toolCounter = 0;

  const nextMessageId = () => {
    messageCounter += 1;
    return `message-${messageCounter}`;
  };

  const nextToolCallId = () => {
    toolCounter += 1;
    return `tool-call-${toolCounter}`;
  };

  for (const message of messages) {
    if (!message) continue;

    if (message.role === "tool") {
      handleToolMessage(message as ToolMessage, conversation, toolLookup, nextMessageId);
      continue;
    }

    if (!isUIRole(message.role)) continue;

    const providedId = (message as any).id;
    const id = typeof providedId === "string" && providedId.trim().length > 0 ? providedId : nextMessageId();
    const parts: UIMessage["parts"] = [];

    const uiMessage: UIMessage = {
      id,
      role: message.role,
      parts,
    };

    const streaming = (message as any).streaming;
    if (typeof streaming === "boolean") uiMessage.streaming = streaming;

    const attachments = (message as any).attachments;
    if (Array.isArray(attachments) && attachments.length > 0) uiMessage.attachments = attachments;

    const meta = (message as any).meta;
    if (meta && typeof meta === "object") uiMessage.meta = { ...(meta as Record<string, unknown>) };

    const textSegments = toTextSegments(message.content);
    for (const segment of textSegments) parts.push({ type: "text", text: segment });

    if (message.role === "assistant") {
      const assistant = message as AssistantMessage & { reasoning?: unknown };
      const usageMeta = toUsageMeta(assistant.usage);
      if (usageMeta) {
        const priorUsage = { ...(uiMessage.meta?.usage ?? {}) };
        uiMessage.meta = { ...(uiMessage.meta ?? {}), usage: { ...priorUsage, ...usageMeta } };
      }

      const reasoningSegments = toReasoningSegments(assistant.reasoning);
      for (const segment of reasoningSegments) parts.push({ type: "reasoning", text: segment });

      if (Array.isArray(assistant.tool_calls)) {
        for (const call of assistant.tool_calls) {
          if (!call) continue;
          const existing = call.id ? toolLookup.get(call.id) : undefined;
          const fallbackId = existing?.invocation.toolCallId ?? nextToolCallId();
          const invocation = toToolInvocation(call, fallbackId, existing?.invocation);
          parts.push({ type: "tool-invocation", toolInvocation: invocation });
        }
      }
    }

    if (uiMessage.parts.length === 0 && !uiMessage.meta) continue;

    conversation.push(uiMessage);

    const messageIndex = conversation.length - 1;
    uiMessage.parts.forEach((part, partIndex) => {
      if (part.type !== "tool-invocation") return;

      const toolCallId = part.toolInvocation.toolCallId;
      toolLookup.set(toolCallId, {
        messageIndex,
        partIndex,
        invocation: part.toolInvocation as MutableToolInvocation,
      });
    });
  }

  return conversation;
};
