import { setApprovalHandler } from "@/services/ai/approval";
import { useMcpService } from "@/services/mcp/useMcpService";
import { appendConversationMessages } from "@/state/actions/appendConversationMessages";
import { getConversation } from "@/state/actions/getConversation";
import { getConversationMessages } from "@/state/actions/getConversationMessages";
import { getSelectedConversationId } from "@/state/actions/getSelectedConversationId";
import { hasCredentials } from "@/state/actions/hasCredentials";
import { setConversationMessages } from "@/state/actions/setConversationMessages";
import type { ApprovalRequest } from "@pstdio/kas";
import { shortUID } from "@pstdio/prompt-utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { examplePrompts } from "../../constant";
import { sendMessage } from "../../services/ai/sendMessage";
import { useWorkspaceStore } from "../../state/WorkspaceProvider";
import type { Message } from "../../types";
import { ConversationArea } from "../conversation/ConversationArea";
import { ApprovalModal } from "./approval-modal";

const EMPTY_MESSAGES: Message[] = [];

export function ConversationHost() {
  const messages = useWorkspaceStore((s) =>
    s.selectedConversationId
      ? (s.conversations[s.selectedConversationId!]?.messages ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );
  const { tools: mcpTools } = useMcpService();
  const [streaming, setStreaming] = useState(false);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalResolve = useRef<((ok: boolean) => void) | null>(null);
  const toolset = useMemo(() => [...mcpTools], [mcpTools]);

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
    const conversationId = getSelectedConversationId();
    const conversation = getConversation(conversationId);

    if (!conversationId || !conversation) return;

    const userMessage: Message = {
      id: shortUID(),
      role: "user",
      parts: [{ type: "text", text }],
    };

    const current = getConversationMessages(conversationId);
    const base = [...current, userMessage];

    setConversationMessages(conversationId, base, "conversations/send/user");

    try {
      setStreaming(true);
      for await (const updated of sendMessage(conversationId, base, toolset)) {
        if (!conversationId) continue;
        setConversationMessages(conversationId, updated, "conversations/send/assistant");
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

      const id = getSelectedConversationId();
      if (id) {
        appendConversationMessages(id, [assistantError], "conversations/send/error");
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
        canSend={hasCredentials() && !streaming}
        examplePrompts={examplePrompts}
        onSendMessage={handleSendMessage}
        onSelectFile={(_path) => {}}
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
