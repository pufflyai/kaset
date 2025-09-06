import { useEffect, useRef, useState } from "react";
import { setApprovalHandler, type ApprovalRequest } from "../../services/ai/KAS/approval";
import { sendMessage } from "../../services/ai/sendMessage";
import { useWorkspaceStore } from "../../state/WorkspaceProvider";
import type { Message } from "../../types";
import { ConversationArea } from "../conversation/ConversationArea";
import { ApprovalModal } from "./approval-modal";

export function ConversationHost() {
  const messages = useWorkspaceStore((s) =>
    s.local.selectedConversationId ? (s.conversations[s.local.selectedConversationId!]?.messages ?? []) : [],
  );

  const [streaming, setStreaming] = useState(false);
  const hasKey = useWorkspaceStore((s) => !!s.local.apiKey);
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
      if (approvalResolve.current) {
        try {
          approvalResolve.current(false);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  const handleSendMessage = async (text: string) => {
    const conversationId = useWorkspaceStore.getState().local.selectedConversationId;
    if (!conversationId) return;

    const userMessage: Message = {
      id:
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : Math.random().toString(36).slice(2),
      role: "user",
      parts: [{ type: "text", text }],
    };

    const current = useWorkspaceStore.getState().conversations[conversationId]?.messages ?? [];
    const base = [...current, userMessage];
    useWorkspaceStore.setState(
      (state) => {
        const convo = state.conversations[conversationId];
        if (convo) {
          convo.messages = base;
        }
      },
      false,
      "conversations/send/user",
    );

    try {
      setStreaming(true);
      for await (const updated of sendMessage(base, "")) {
        const id = useWorkspaceStore.getState().local.selectedConversationId;
        if (!id) continue;
        useWorkspaceStore.setState(
          (state) => {
            const convo = state.conversations[id];
            if (convo) {
              convo.messages = updated;
            }
          },
          false,
          "conversations/send/assistant",
        );
      }
    } catch (err) {
      const assistantError: Message = {
        id: Math.random().toString(36).slice(2),
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Sorry, I couldn't process that. ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };

      const id = useWorkspaceStore.getState().local.selectedConversationId;
      if (id) {
        useWorkspaceStore.setState(
          (state) => {
            const convo = state.conversations[id];
            if (convo) {
              convo.messages = [...convo.messages, assistantError];
            }
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
          useWorkspaceStore.setState(
            (state) => {
              state.local.filePath = path ?? undefined;
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
