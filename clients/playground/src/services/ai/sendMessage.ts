import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { readFile } from "@pstdio/opfs-utils";
import { type AssistantMessage, type BaseMessage } from "@pstdio/tiny-ai-tasks";
import type { Message, ToolInvocation, UIConversation } from "../../types";
import { getAgent } from "./KAS/agent";
import { getLastUserText, toMessageHistory, uid } from "./utils";

/**
 * Connect the Tiny AI Tasks agent to the chat UI.
 * - Streams assistant content as it arrives
 * - Emits tool invocation input/output as timeline entries
 */
export async function* sendMessage(conversation: UIConversation, _cwd?: string) {
  let uiMessages: UIConversation = [...conversation];
  yield uiMessages;

  const userText = getLastUserText(uiMessages);
  if (!userText) return;

  // Track tool call metadata to pair tool outputs later
  const toolMeta = new Map<string, { name: string; input: any }>();
  // Map toolCallId -> UI message id for upserting instead of duplicating
  const toolUiMessageId = new Map<string, string>();

  // Manage the current assistant text message while streaming
  let currentAssistantId: string | null = null;

  // Helper: finalize the current assistant text message and reset the tracker
  const finalizeAssistantTextIfAny = () => {
    if (!currentAssistantId) return;
    uiMessages = uiMessages.map((m) => {
      if (m.id !== currentAssistantId) return m;
      const part = m.parts[0] as any;
      return { ...m, parts: [{ ...part, state: "done" }] } as Message;
    });
    currentAssistantId = null;
  };

  // Helper: upsert a streaming assistant text message
  const upsertAssistantText = (text: string, done = false) => {
    if (!currentAssistantId) {
      const id = uid();
      currentAssistantId = id;
      const msg: Message = {
        id,
        role: "assistant",
        parts: [{ type: "text", text, state: done ? "done" : "streaming" }],
      };
      uiMessages = [...uiMessages, msg];
      return;
    }

    uiMessages = uiMessages.map((m) => {
      if (m.id !== currentAssistantId) return m;
      return {
        ...m,
        parts: [{ type: "text", text, state: done ? "done" : "streaming" }],
      } as Message;
    });
  };

  // Helper: upsert a tool invocation by toolCallId to avoid duplicates while streaming
  const upsertToolInvocation = (inv: ToolInvocation) => {
    const { toolCallId } = inv;

    const existingMsgId = toolUiMessageId.get(toolCallId);

    if (!existingMsgId) {
      const msgId = uid();
      toolUiMessageId.set(toolCallId, msgId);

      const msg: Message = {
        id: msgId,
        role: "assistant",
        parts: [{ type: "tool-invocation", toolInvocation: inv }],
      };

      uiMessages = [...uiMessages, msg];
      return;
    }

    uiMessages = uiMessages.map((m) => {
      if (m.id !== existingMsgId) return m;

      const parts = m.parts.map((p) => {
        if ((p as any).type !== "tool-invocation") return p;
        const ti = (p as any).toolInvocation as ToolInvocation;
        if (ti.toolCallId !== toolCallId) return p;

        // Merge states by replacing with latest while preserving tool type and call id
        const next: ToolInvocation = {
          type: inv.type || ti.type,
          toolCallId: toolCallId,
          ...(inv as any),
        } as ToolInvocation;

        return { type: "tool-invocation", toolInvocation: next } as any;
      });

      return { ...m, parts } as Message;
    });
  };

  // Build full history from the UI conversation so the agent has context
  const initial: BaseMessage[] = toMessageHistory(uiMessages);

  if (uiMessages.length <= 1) {
    try {
      const s = useWorkspaceStore.getState().local;
      const ns = s.namespace || "playground";
      const proj = s.selectedProjectId || "todo";
      const baseProj = `${ns}/${proj}`;
      const pathsToTry = [
        `${baseProj}/agents.md`,
        `${baseProj}/AGENTS.md`,
        `${ns}/agents.md`,
        `${ns}/AGENTS.md`,
      ];
      let content: string | null = null;

      for (const p of pathsToTry) {
        try {
          content = await readFile(p);
          if (content) break;
        } catch (err) {
          content = null;
        }
      }

      if (content && content.trim().length > 0) {
        initial.unshift({ role: "system", content });
      }
    } catch {}
  }

  const agent = getAgent();
  
  for await (const [chunk] of agent(initial as any)) {
    const items = Array.isArray(chunk) ? (chunk as (AssistantMessage | any)[]) : [];

    for (const msg of items) {
      // Assistant text and tool-calls (streamed)
      if ((msg as AssistantMessage)?.role === "assistant") {
        const a = msg as AssistantMessage;

        // If tool calls are present in this assistant chunk, surface them first
        const calls = Array.isArray(a.tool_calls) ? a.tool_calls : [];
        if (calls.length > 0) {
          // A new tool-call phase indicates the prior assistant text (if any) is complete
          // Finalize it so future assistant text starts a fresh message instead of overwriting.
          finalizeAssistantTextIfAny();
          for (const call of calls) {
            const callId = call.id || uid();
            const toolName = call.function?.name || "tool";
            let parsed: any = undefined;
            try {
              parsed = call.function?.arguments ? JSON.parse(call.function.arguments) : undefined;
            } catch {
              parsed = call.function?.arguments ?? undefined;
            }

            // Track latest input seen for this tool call id
            toolMeta.set(callId, { name: toolName, input: parsed });

            // Upsert to avoid duplicate entries while arguments stream
            upsertToolInvocation({
              type: `tool-${toolName}`,
              toolCallId: callId,
              state: "input-available",
              input: parsed,
            } as any);
          }
        }

        // Stream assistant text only when there are no tool_calls in this chunk
        // This prevents creating an empty/placeholder assistant message before tools run
        const txt = (a.content ?? "").toString();
        if (calls.length === 0) {
          const hasText = typeof txt === "string" && txt.trim().length > 0;
          if (hasText) {
            upsertAssistantText(txt, false);
          }
        }

        // Yield updated UI state after processing this assistant delta
        yield uiMessages;
        continue;
      }

      // Tool outputs (role: "tool")
      if ((msg as any)?.role === "tool" && typeof (msg as any)?.content === "string") {
        const toolCallId = (msg as any).tool_call_id as string;
        const meta = toolMeta.get(toolCallId) || { name: "tool", input: undefined };

        let output = undefined;
        let isError = false;
        let errorText: string | undefined = undefined;
        try {
          output = JSON.parse(msg.content);
          if (output && output.success === false) {
            isError = true;
            errorText = typeof output.error === "string" ? output.error : JSON.stringify(output.error);
          }
        } catch {
          output = msg.content;
        }

        // Update existing tool invocation entry with final output or error
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

        console.log({ uiMessages });

        continue;
      }
    }
  }

  // Mark the last assistant text as done if present
  if (currentAssistantId) {
    finalizeAssistantTextIfAny();
    yield uiMessages;
  }
}
