import { shortUID } from "@pstdio/prompt-utils";
import { type AssistantMessage } from "@pstdio/tiny-ai-tasks";
import type { Message, TokenUsage, ToolInvocation, UIConversation } from "./types";

type AgentStream = AsyncIterable<[AssistantMessage[] | AssistantMessage | any, any, any]>;

type ToConversationOpts = {
  boot: UIConversation;
  devNote: { id: string; startedAt: number };
};

type ToolMeta = { name: string; input: any };

/**
 * Converts an agent stream into a UI conversation.
 *
 */
export async function* toConversation(agentStream: AgentStream, { boot, devNote }: ToConversationOpts) {
  let uiMessages: UIConversation = [...boot];

  // Yield the boot state immediately so the UI can render
  // the initial developer "Thinking..." note before the
  // first model/tool chunks arrive.
  yield uiMessages;

  let thoughtMarked = false;
  let currentAssistantId: string | null = null;
  let lastAssistantMessageId: string | null = null;
  let currentAssistantUsage: TokenUsage | undefined;
  const toolMeta = new Map<string, ToolMeta>();
  const toolUiMessageId = new Map<string, string>();

  const applyCurrentAssistantUsage = () => {
    if (!currentAssistantUsage) return;

    const targetAssistantId = currentAssistantId ?? lastAssistantMessageId;
    const targetUserId = (() => {
      for (let i = uiMessages.length - 1; i >= 0; i -= 1) {
        const candidate = uiMessages[i];
        if (candidate.role === "user") {
          return candidate.id;
        }
      }
      return null;
    })();

    const { promptTokens, completionTokens, totalTokens } = currentAssistantUsage;

    uiMessages = uiMessages.map((m) => {
      if (targetAssistantId && m.id === targetAssistantId) {
        const priorUsage = { ...(m.meta?.usage ?? {}) };
        if (promptTokens !== undefined) {
          priorUsage.promptTokens = promptTokens;
        }
        if (completionTokens !== undefined) {
          priorUsage.completionTokens = completionTokens;
        }
        if (totalTokens !== undefined) {
          priorUsage.totalTokens = totalTokens;
        }

        const meta = { ...(m.meta ?? {}), usage: priorUsage };
        return { ...m, meta } as Message;
      }

      if (targetUserId && m.id === targetUserId && promptTokens !== undefined) {
        const priorUsage = { ...(m.meta?.usage ?? {}) };
        priorUsage.promptTokens = promptTokens;

        const meta = { ...(m.meta ?? {}), usage: priorUsage };
        return { ...m, meta } as Message;
      }

      return m;
    });
  };

  const finalizeAssistantTextIfAny = () => {
    if (!currentAssistantId) return;
    uiMessages = uiMessages.map((m) => {
      if (m.id !== currentAssistantId) return m;
      const part = m.parts[0] as any;
      return { ...m, parts: [{ ...part, state: "done" }] } as Message;
    });
    currentAssistantId = null;
    currentAssistantUsage = undefined;
  };

  const upsertAssistantText = (text: string, done = false) => {
    if (!currentAssistantId) {
      const id = shortUID();
      currentAssistantId = id;
      lastAssistantMessageId = id;
      const msg: Message = {
        id,
        role: "assistant",
        parts: [{ type: "text", text, state: done ? "done" : "streaming" }],
      };
      uiMessages = [...uiMessages, msg];
    } else {
      uiMessages = uiMessages.map((m) => {
        if (m.id !== currentAssistantId) return m;
        return {
          ...m,
          parts: [{ type: "text", text, state: done ? "done" : "streaming" }],
        } as Message;
      });

      lastAssistantMessageId = currentAssistantId;
    }

    if (currentAssistantUsage) {
      applyCurrentAssistantUsage();
    }
  };

  const upsertToolInvocation = (inv: ToolInvocation) => {
    const { toolCallId } = inv;
    const existingMsgId = toolUiMessageId.get(toolCallId);

    if (!existingMsgId) {
      const msgId = shortUID();
      toolUiMessageId.set(toolCallId, msgId);

      const msg: Message = {
        id: msgId,
        role: "assistant",
        parts: [{ type: "tool-invocation", toolInvocation: inv }],
      };

      uiMessages = [...uiMessages, msg];
      lastAssistantMessageId = msgId;
      return;
    }

    uiMessages = uiMessages.map((m) => {
      if (m.id !== existingMsgId) return m;

      const parts = m.parts.map((p) => {
        if ((p as any).type !== "tool-invocation") return p;
        const ti = (p as any).toolInvocation as ToolInvocation;
        if (ti.toolCallId !== toolCallId) return p;

        const next: ToolInvocation = {
          type: inv.type || ti.type,
          toolCallId,
          ...(inv as any),
        } as ToolInvocation;

        return { type: "tool-invocation", toolInvocation: next } as any;
      });

      return { ...m, parts } as Message;
    });

    lastAssistantMessageId = existingMsgId;
    applyCurrentAssistantUsage();
  };

  const markDevNoteIfNeeded = () => {
    if (thoughtMarked) return;
    const secs = Math.max(0, Math.round((Date.now() - devNote.startedAt) / 1000));
    uiMessages = uiMessages.map((m) =>
      m.id === devNote.id
        ? ({ ...m, parts: [{ type: "reasoning", text: `Thought for ${secs} seconds`, state: "done" }] } as Message)
        : m,
    );
    thoughtMarked = true;
  };

  for await (const [chunk] of agentStream) {
    const items = Array.isArray(chunk) ? (chunk as (AssistantMessage | any)[]) : [];

    for (const msg of items) {
      if ((msg as AssistantMessage)?.role === "assistant") {
        const a = msg as AssistantMessage;

        // When first content arrives
        markDevNoteIfNeeded();

        const calls = Array.isArray(a.tool_calls) ? a.tool_calls : [];
        if (calls.length > 0) {
          // Finish any ongoing text message before surfacing tools
          finalizeAssistantTextIfAny();

          for (const call of calls) {
            const callId = call.id || shortUID();
            const toolName = call.function?.name || "tool";
            let parsed: any = undefined;
            try {
              parsed = call.function?.arguments ? JSON.parse(call.function.arguments) : undefined;
            } catch {
              parsed = call.function?.arguments ?? undefined;
            }

            toolMeta.set(callId, { name: toolName, input: parsed });

            upsertToolInvocation({
              type: `tool-${toolName}`,
              toolCallId: callId,
              state: "input-available",
              input: parsed,
            } as any);
          }
        }

        const txt = (a.content ?? "").toString();
        if (calls.length === 0 && typeof txt === "string" && txt.trim().length > 0) {
          upsertAssistantText(txt, false);
        }

        if (a.usage) {
          currentAssistantUsage = {
            promptTokens: a.usage.prompt_tokens ?? undefined,
            completionTokens: a.usage.completion_tokens ?? undefined,
            totalTokens: a.usage.total_tokens ?? undefined,
          } satisfies TokenUsage;
          applyCurrentAssistantUsage();
        }

        yield uiMessages;
        continue;
      }

      if ((msg as any)?.role === "tool" && typeof (msg as any)?.content === "string") {
        markDevNoteIfNeeded();

        const toolCallId = (msg as any).tool_call_id as string;
        const meta = toolMeta.get(toolCallId) || { name: "tool", input: undefined };

        let output: unknown = undefined;
        let isError = false;
        let errorText: string | undefined = undefined;

        try {
          output = JSON.parse(msg.content);
          if (output && (output as any).success === false) {
            isError = true;
            const err = (output as any).error;
            errorText = typeof err === "string" ? err : JSON.stringify(err);
          }
        } catch {
          output = msg.content;
        }

        upsertToolInvocation(
          (isError
            ? {
                type: `tool-${meta.name}`,
                toolCallId,
                state: "output-error",
                input: meta.input,
                errorText: errorText || (typeof output === "string" ? output : JSON.stringify(output)),
                providerExecuted: true,
              }
            : {
                type: `tool-${meta.name}`,
                toolCallId,
                state: "output-available",
                input: meta.input,
                output,
                providerExecuted: true,
              }) as any,
        );

        yield uiMessages;
        continue;
      }
    }
  }

  if (currentAssistantId) {
    finalizeAssistantTextIfAny();
  }

  markDevNoteIfNeeded();

  yield uiMessages;
}
