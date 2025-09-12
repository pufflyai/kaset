import { PROJECTS_ROOT } from "@/constant";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { commitAll, continueFromCommit, ensureRepo, getHeadState, readFile } from "@pstdio/opfs-utils";
import { shortUID } from "@pstdio/prompt-utils";
import {
  type AssistantMessage,
  type BaseMessage,
  type ExtendedMessage,
  filterHistory,
  toBaseMessages,
} from "@pstdio/tiny-ai-tasks";
import type { Message, ToolInvocation, UIConversation } from "../../types";
import { getAgent } from "./getAgent";
import { getLastUserText, toMessageHistory } from "./utils";

/**
 * Connect the Tiny AI Tasks agent to the chat UI.
 * - Streams assistant content as it arrives
 * - Emits tool invocation input/output as timeline entries
 */
export async function* sendMessage(conversation: UIConversation, _cwd?: string) {
  let uiMessages: UIConversation = [...conversation];

  // Determine if this is the first user turn before we add our developer message
  const isFirstTurn = uiMessages.length <= 1;

  // Insert a hidden developer note that is visible in the UI but filtered from the LLM prompt
  const thoughtId = shortUID();
  const thoughtStart = Date.now();
  let thoughtMarked = false;
  const developerThinking: Message = {
    id: thoughtId,
    role: "developer",
    meta: { hidden: true, tags: ["thinking"] },
    parts: [{ type: "reasoning", text: "Thinking...", state: "streaming" }],
  } as Message;

  uiMessages = [...uiMessages, developerThinking];
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
      const id = shortUID();
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
      const msgId = shortUID();
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
  // Use ExtendedMessage and filterHistory to exclude hidden developer notes from the LLM prompt
  const baseFromUI: BaseMessage[] = toMessageHistory(uiMessages);
  const extendedFromUI: ExtendedMessage[] = baseFromUI.map((m) => ({ ...m }));

  if (isFirstTurn) {
    // Use the same namespace and project as the UI (see App.tsx)
    const ns = PROJECTS_ROOT;
    const proj = useWorkspaceStore.getState().selectedProjectId || "todo";
    const baseProj = `${ns}/${proj}`;

    const pathsToTry = [`${baseProj}/agents.md`, `${baseProj}/AGENTS.md`, `${ns}/agents.md`, `${ns}/AGENTS.md`];

    let content: string | null = null;
    for (const p of pathsToTry) {
      try {
        content = await readFile(p);
        if (content) break;
      } catch {
        content = null;
      }
    }

    if (content && content.trim().length > 0) {
      extendedFromUI.unshift({ role: "system", content } as ExtendedMessage);
    }
  }

  // Also append our hidden developer note to history (so filterHistory can remove it for LLM)
  extendedFromUI.push({ role: "developer", content: "Thinking...", meta: { hidden: true, tags: ["thinking"] } });

  const initial: BaseMessage[] = toBaseMessages(filterHistory(extendedFromUI, { excludeHidden: true }));

  const agent = getAgent();

  for await (const [chunk] of agent(initial as any)) {
    const items = Array.isArray(chunk) ? (chunk as (AssistantMessage | any)[]) : [];

    for (const msg of items) {
      // Assistant text and tool-calls (streamed)
      if ((msg as AssistantMessage)?.role === "assistant") {
        const a = msg as AssistantMessage;

        // Mark developer thinking note with elapsed time on first assistant chunk
        if (!thoughtMarked) {
          const secs = Math.max(0, Math.round((Date.now() - thoughtStart) / 1000));
          uiMessages = uiMessages.map((m) =>
            m.id === thoughtId
              ? ({
                  ...m,
                  parts: [{ type: "reasoning", text: `Thought for ${secs} seconds`, state: "done" }],
                } as Message)
              : m,
          );
          thoughtMarked = true;
        }

        // If tool calls are present in this assistant chunk, surface them first
        const calls = Array.isArray(a.tool_calls) ? a.tool_calls : [];
        if (calls.length > 0) {
          // A new tool-call phase indicates the prior assistant text (if any) is complete
          // Finalize it so future assistant text starts a fresh message instead of overwriting.
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
        // In rare cases, tool messages may arrive before assistant text; mark the developer note
        if (!thoughtMarked) {
          const secs = Math.max(0, Math.round((Date.now() - thoughtStart) / 1000));
          uiMessages = uiMessages.map((m) =>
            m.id === thoughtId
              ? ({
                  ...m,
                  parts: [{ type: "reasoning", text: `Thought for ${secs} seconds`, state: "done" }],
                } as Message)
              : m,
          );
          thoughtMarked = true;
        }
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

        continue;
      }
    }
  }

  // Mark the last assistant text as done if present
  if (currentAssistantId) {
    finalizeAssistantTextIfAny();
    // If for some reason no assistant/tool chunk was processed, finalize the developer note, too
    if (!thoughtMarked) {
      const secs = Math.max(0, Math.round((Date.now() - thoughtStart) / 1000));
      uiMessages = uiMessages.map((m) =>
        m.id === thoughtId
          ? ({ ...m, parts: [{ type: "reasoning", text: `Thought for ${secs} seconds`, state: "done" }] } as Message)
          : m,
      );
      thoughtMarked = true;
    }

    yield uiMessages;
  }

  // After the AI finishes, attempt to auto-commit any project changes
  try {
    const proj = useWorkspaceStore.getState().selectedProjectId;
    const dir = `/${PROJECTS_ROOT}/${proj}`;

    await ensureRepo({ dir });

    // If HEAD is detached (e.g., after previewing a commit), smart-attach:
    // - If at a branch tip, reattach to that branch.
    // - Otherwise, create a new continue/<sha> branch to avoid overriding history.

    const head = await getHeadState({ dir });
    if (head.detached) {
      await continueFromCommit({ dir }, { to: head.headOid || "HEAD", force: true, refuseUpdateExisting: true });
    }

    // Commit to the current branch (post-reattach if needed)
    let targetBranch: string | undefined = undefined;

    const h2 = await getHeadState({ dir });
    if (!h2.detached && h2.currentBranch) targetBranch = h2.currentBranch;

    await commitAll(
      { dir },
      {
        message: "chore: AI updates",
        author: { name: "KAS", email: "kas@kaset.dev" },
        ...(targetBranch ? { branch: targetBranch } : {}),
      },
    );
  } catch (e) {
    console.error("Auto-commit after AI changes failed:", e);
  }
}
