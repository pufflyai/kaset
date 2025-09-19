import { PROJECTS_ROOT } from "@/constant";
import { setApprovalHandler } from "@/services/ai/approval";
import type { ApprovalRequest } from "@pstdio/kas";
import { shortUID } from "@pstdio/prompt-utils";
import { useEffect, useRef, useState } from "react";
import { sendMessage } from "../../services/ai/sendMessage";
import { useWorkspaceStore } from "../../state/WorkspaceProvider";
import type { Message } from "../../types";
import { ConversationArea } from "../conversation/ConversationArea";
import { ApprovalModal } from "./approval-modal";

const EMPTY_MESSAGES: Message[] = [];

function normalizeProjectPath(input: string | undefined | null): string | undefined {
  if (!input) return undefined;

  const projectId = useWorkspaceStore.getState().selectedProjectId || "todo";
  const rootDir = `${PROJECTS_ROOT}/${projectId}`;

  // Normalize slashes and trim
  const p = String(input).replace(/\\/g, "/").replace(/^\/+/, "").trim();
  const root = rootDir.replace(/\\/g, "/").replace(/^\/+/, "");

  // If already absolute to project root, keep as-is
  if (p === root || p.startsWith(root + "/")) return p;

  // Otherwise, treat as path relative to the project root
  return [root, p].filter(Boolean).join("/");
}

export function ConversationHost() {
  const messages = useWorkspaceStore((s) =>
    s.selectedConversationId
      ? (s.conversations[s.selectedConversationId!]?.messages ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );

  const [streaming, setStreaming] = useState(false);
  const hasKey = useWorkspaceStore((s) => !!s.apiKey);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalResolve = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    setApprovalHandler(
      (req) =>
        new Promise<boolean>((resolve) => {
          setApproval(req);
          approvalResolve.current = resolve;
        }),
    );

    return () => {
      // On unmount, reset handler and resolve any pending approval as denied
      setApprovalHandler(null);
      approvalResolve.current?.(false);
    };
  }, []);

  const handleSendMessage = async (text: string) => {
    const conversationId = useWorkspaceStore.getState().selectedConversationId;
    const convo = useWorkspaceStore.getState().conversations[conversationId];

    if (!conversationId || !convo) return;

    const userMessage: Message = {
      id: shortUID(),
      role: "user",
      parts: [{ type: "text", text }],
    };

    const current = useWorkspaceStore.getState().conversations[conversationId]?.messages ?? [];
    const base = [...current, userMessage];

    useWorkspaceStore.setState(
      (state) => {
        state.conversations[conversationId].messages = base;
      },
      false,
      "conversations/send/user",
    );

    try {
      setStreaming(true);
      for await (const updated of sendMessage(conversationId, base)) {
        if (!conversationId) continue;
        useWorkspaceStore.setState(
          (state) => {
            state.conversations[conversationId].messages = updated;
          },
          false,
          "conversations/send/assistant",
        );
      }
    } catch (err) {
      const assistantError: Message = {
        id: shortUID(),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Sorry, I couldn't process that. ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };

      const stateSnapshot = useWorkspaceStore.getState();
      const id = stateSnapshot.selectedConversationId;

      if (id) {
        const currentMessages = stateSnapshot.conversations[id]?.messages ?? base;

        useWorkspaceStore.setState(
          (state) => {
            state.conversations[id].messages = [...currentMessages, assistantError];
          },
          false,
          "conversations/send/error",
        );
      }
    } finally {
      setStreaming(false);
    }
  };

  return (
    <>
      <ConversationArea
        messages={messages}
        streaming={streaming}
        canSend={hasKey && !streaming}
        onSendMessage={handleSendMessage}
        onSelectFile={(path) => {
          const full = normalizeProjectPath(path);
          useWorkspaceStore.setState(
            (state) => {
              state.filePath = full ?? undefined;
              if (full) state.selectedTab = "code";
            },
            false,
            "conversation/select-file",
          );
        }}
      />
      <ApprovalModal
        request={approval}
        onApprove={() => {
          approvalResolve.current?.(true);
          setApproval(null);
          approvalResolve.current = null;
        }}
        onDeny={() => {
          approvalResolve.current?.(false);
          setApproval(null);
          approvalResolve.current = null;
        }}
      />
    </>
  );
}
