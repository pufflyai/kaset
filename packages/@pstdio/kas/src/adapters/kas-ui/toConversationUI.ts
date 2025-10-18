import { shortUID } from "@pstdio/prompt-utils";
import type { AssistantMessage, ToolMessage } from "@pstdio/tiny-ai-tasks";
import { messageContentToString } from "@pstdio/tiny-ai-tasks";
import type { ToolInvocation, ToolInvocationUIPart, TokenUsage, UIConversation, UIMessage } from "./types";

type AgentStream = AsyncIterable<[AssistantMessage[] | AssistantMessage | any, unknown, unknown]>;

type ToolMeta = { name: string; input: any };

const parseJSON = (value: unknown) => {
  if (typeof value !== "string") return value;

  const text = value.trim();
  if (!text) return value;

  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
};

const toUsage = (usage?: AssistantMessage["usage"]): TokenUsage | undefined => {
  if (!usage) return undefined;

  const promptTokens = usage.prompt_tokens;
  const completionTokens = usage.completion_tokens;
  const totalTokens = usage.total_tokens;

  if (promptTokens === undefined && completionTokens === undefined && totalTokens === undefined) return undefined;

  return {
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(totalTokens !== undefined ? { totalTokens } : {}),
  };
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

const toolInvocationEquals = (next: ToolInvocation, prev: ToolInvocation) => {
  try {
    return JSON.stringify(next) === JSON.stringify(prev);
  } catch {
    return false;
  }
};

export const toConversationUI = async function* (stream: AgentStream) {
  let uiMessages: UIConversation = [];

  let currentAssistantId: string | null = null;
  let lastAssistantMessageId: string | null = null;
  let currentAssistantUsage: TokenUsage | undefined;

  const toolMeta = new Map<string, ToolMeta>();
  const toolUiMessageId = new Map<string, string>();

  const findLastUserId = () => {
    for (let i = uiMessages.length - 1; i >= 0; i -= 1) {
      const candidate = uiMessages[i];
      if (candidate.role === "user") return candidate.id;
    }
    return null;
  };

  const applyCurrentAssistantUsage = () => {
    if (!currentAssistantUsage) return false;

    let mutated = false;
    const targetAssistantId = currentAssistantId ?? lastAssistantMessageId;
    const targetUserId = findLastUserId();

    if (targetAssistantId) {
      uiMessages = uiMessages.map((message) => {
        if (message.id !== targetAssistantId) return message;

        const priorUsage = { ...(message.meta?.usage ?? {}) };
        const nextUsage = { ...priorUsage };

        if (currentAssistantUsage?.promptTokens !== undefined)
          nextUsage.promptTokens = currentAssistantUsage.promptTokens;
        if (currentAssistantUsage?.completionTokens !== undefined)
          nextUsage.completionTokens = currentAssistantUsage.completionTokens;
        if (currentAssistantUsage?.totalTokens !== undefined) nextUsage.totalTokens = currentAssistantUsage.totalTokens;

        const unchanged =
          priorUsage.promptTokens === nextUsage.promptTokens &&
          priorUsage.completionTokens === nextUsage.completionTokens &&
          priorUsage.totalTokens === nextUsage.totalTokens;

        if (unchanged) return message;

        mutated = true;
        const meta = { ...(message.meta ?? {}), usage: nextUsage };
        return { ...message, meta };
      });
    }

    const promptTokens = currentAssistantUsage?.promptTokens;

    if (targetUserId && promptTokens !== undefined) {
      uiMessages = uiMessages.map((message) => {
        if (message.id !== targetUserId) return message;

        const priorUsage = { ...(message.meta?.usage ?? {}) };
        if (priorUsage.promptTokens === promptTokens) return message;

        mutated = true;
        const meta = {
          ...(message.meta ?? {}),
          usage: { ...priorUsage, promptTokens },
        };
        return { ...message, meta };
      });
    }

    return mutated;
  };

  const finalizeAssistantTextIfAny = () => {
    if (!currentAssistantId) return false;

    let mutated = false;

    uiMessages = uiMessages.map((message) => {
      if (message.id !== currentAssistantId) return message;
      const part = message.parts[0];
      if (!part || part.type !== "text") return message;
      if (part.state === "done") return message;

      mutated = true;
      return {
        ...message,
        parts: [{ ...part, state: "done" }],
      };
    });

    currentAssistantId = null;
    currentAssistantUsage = undefined;

    return mutated;
  };

  const upsertAssistantText = (text: string, done = false) => {
    const trimmed = text.trim();
    if (!trimmed) return false;

    const state = done ? "done" : "streaming";
    let mutated = false;

    if (!currentAssistantId) {
      const id = shortUID();
      currentAssistantId = id;
      lastAssistantMessageId = id;

      const message: UIMessage = {
        id,
        role: "assistant",
        parts: [{ type: "text", text, state }],
      };

      uiMessages = [...uiMessages, message];
      mutated = true;
    } else {
      uiMessages = uiMessages.map((message) => {
        if (message.id !== currentAssistantId) return message;

        const part = message.parts[0];
        if (part && part.type === "text" && part.text === text && part.state === state) return message;

        mutated = true;
        return {
          ...message,
          parts: [{ type: "text", text, state }],
        };
      });

      lastAssistantMessageId = currentAssistantId;
    }

    if (mutated) applyCurrentAssistantUsage();
    return mutated;
  };

  const upsertToolInvocation = (invocation: ToolInvocation) => {
    const { toolCallId } = invocation;
    let mutated = false;

    const existingMessageId = toolUiMessageId.get(toolCallId);

    if (!existingMessageId) {
      const messageId = shortUID();
      toolUiMessageId.set(toolCallId, messageId);

      const message: UIMessage = {
        id: messageId,
        role: "assistant",
        parts: [{ type: "tool-invocation", toolInvocation: invocation }],
      };

      uiMessages = [...uiMessages, message];
      lastAssistantMessageId = messageId;
      mutated = true;
    } else {
      uiMessages = uiMessages.map((message) => {
        if (message.id !== existingMessageId) return message;

        const parts = message.parts.map((part) => {
          if (part.type !== "tool-invocation") return part;
          if (part.toolInvocation.toolCallId !== toolCallId) return part;

          const merged: ToolInvocation = {
            ...part.toolInvocation,
            ...invocation,
            type: invocation.type || part.toolInvocation.type,
          };

          if (toolInvocationEquals(merged, part.toolInvocation)) return part;

          mutated = true;
          const nextPart: ToolInvocationUIPart = { type: "tool-invocation", toolInvocation: merged };
          return nextPart;
        });

        if (!mutated) return message;

        lastAssistantMessageId = existingMessageId;
        return { ...message, parts };
      });
    }

    if (mutated) applyCurrentAssistantUsage();
    return mutated;
  };

  for await (const [chunk] of stream) {
    const items = Array.isArray(chunk) ? chunk : chunk != null ? [chunk] : [];

    for (const item of items) {
      if (!item) continue;

      const role = (item as AssistantMessage | ToolMessage)?.role;

      if (role === "assistant") {
        const assistant = item as AssistantMessage;
        let mutated = false;

        const toolCalls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
        if (toolCalls.length > 0) {
          if (finalizeAssistantTextIfAny()) mutated = true;

          for (const call of toolCalls) {
            if (!call) continue;
            const rawId = call.id?.trim();
            const toolCallId = rawId && rawId.length > 0 ? rawId : shortUID();
            const toolName = call.function?.name?.trim() || call.type?.trim() || "tool";
            const parsedArgs = parseJSON(call.function?.arguments ?? "");

            toolMeta.set(toolCallId, { name: toolName, input: parsedArgs });

            mutated =
              upsertToolInvocation({
                type: `tool-${toolName}`,
                toolCallId,
                state: "input-available",
                input: parsedArgs,
              }) || mutated;
          }
        }

        const text = messageContentToString(assistant.content);
        if (toolCalls.length === 0 && text.trim().length > 0) {
          mutated = upsertAssistantText(text, false) || mutated;
        }

        const usage = toUsage(assistant.usage);
        if (usage) {
          currentAssistantUsage = usage;
          mutated = applyCurrentAssistantUsage() || mutated;
        }

        if (mutated) yield uiMessages;
        continue;
      }

      if (role === "tool") {
        const tool = item as ToolMessage;
        let mutated = false;

        const toolCallId = String(tool.tool_call_id ?? "").trim();
        if (!toolCallId) continue;

        const meta = toolMeta.get(toolCallId) ?? { name: "tool", input: undefined };
        const rawContent = messageContentToString(tool.content);
        const parsed = parseJSON(rawContent);

        if (parsed && typeof parsed === "object" && (parsed as any).success === false) {
          const err = (parsed as any).error ?? parsed;
          mutated =
            upsertToolInvocation({
              type: `tool-${meta.name}`,
              toolCallId,
              state: "output-error",
              input: meta.input,
              providerExecuted: true,
              rawInput: parsed,
              errorText: toErrorText(err),
            }) || mutated;
        } else {
          const output =
            parsed && typeof parsed === "object" && "data" in (parsed as any) ? (parsed as any).data : parsed;

          mutated =
            upsertToolInvocation({
              type: `tool-${meta.name}`,
              toolCallId,
              state: "output-available",
              input: meta.input,
              providerExecuted: true,
              output,
            }) || mutated;
        }

        if (mutated) yield uiMessages;
        continue;
      }
    }
  }

  const finalized = finalizeAssistantTextIfAny();
  const usageApplied = applyCurrentAssistantUsage();

  if (uiMessages.length > 0 || finalized || usageApplied) {
    yield uiMessages;
  }
};
