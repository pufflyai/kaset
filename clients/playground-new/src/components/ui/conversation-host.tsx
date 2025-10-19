import { setApprovalHandler } from "@/services/ai/approval";
import { useMcpService } from "@/services/mcp/useMcpService";
import { appendConversationMessages } from "@/state/actions/appendConversationMessages";
import { getConversation } from "@/state/actions/getConversation";
import { getConversationMessages } from "@/state/actions/getConversationMessages";
import { getSelectedConversationId } from "@/state/actions/getSelectedConversationId";
import { hasCredentials } from "@/state/actions/hasCredentials";
import { setConversationMessages } from "@/state/actions/setConversationMessages";
import type { ApprovalRequest } from "@pstdio/kas";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { shortUID } from "@pstdio/prompt-utils";
import debounce from "lodash/debounce";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { examplePrompts } from "../../constant";
import { sendMessage } from "../../services/ai/sendMessage";
import { usePluginHost } from "../../services/plugins/usePluginHost";
import { useWorkspaceStore } from "../../state/WorkspaceProvider";
import { ConversationArea } from "@/kas-ui/components/conversation";
import { ApprovalModal } from "./approval-modal";

const EMPTY_MESSAGES: UIMessage[] = [];

interface ConversationAreaWithMessagesProps {
  streaming: boolean;
  canSend: boolean;
  examplePrompts: string[];
  onSendMessage: (text: string, fileNames?: string[]) => void | Promise<void>;
  onSelectFile?: (filePath: string) => void;
}

const ConversationAreaWithMessages = memo(function ConversationAreaWithMessages(
  props: ConversationAreaWithMessagesProps,
) {
  const { streaming, canSend, examplePrompts, onSendMessage, onSelectFile } = props;
  const messages = useWorkspaceStore((s) =>
    s.selectedConversationId
      ? (s.conversations[s.selectedConversationId!]?.messages ?? EMPTY_MESSAGES)
      : EMPTY_MESSAGES,
  );

  return (
    <ConversationArea
      messages={messages}
      streaming={streaming}
      canSend={canSend}
      examplePrompts={examplePrompts}
      onSendMessage={onSendMessage}
      onSelectFile={onSelectFile}
    />
  );
});

export function ConversationHost() {
  const { tools: mcpTools } = useMcpService();
  const { tools: pluginTools } = usePluginHost();
  const [streaming, setStreaming] = useState(false);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalResolve = useRef<((ok: boolean) => void) | null>(null);
  const toolset = useMemo(() => [...pluginTools, ...mcpTools], [pluginTools, mcpTools]);

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

  const handleSendMessage = useCallback(
    async (text: string) => {
      const conversationId = getSelectedConversationId();
      const conversation = getConversation(conversationId);

      if (!conversationId || !conversation) return;

      const userMessage: UIMessage = {
        id: shortUID(),
        role: "user",
        parts: [{ type: "text", text }],
      };

      const current = getConversationMessages(conversationId);
      const base = [...current, userMessage];

      const applyConversationUpdate = debounce(
        (nextMessages: UIMessage[]) => {
          setConversationMessages(conversationId, nextMessages, "conversations/send/assistant");
        },
        500,
        { leading: true, trailing: true },
      );

      setConversationMessages(conversationId, base, "conversations/send/user");

      try {
        setStreaming(true);
        for await (const updated of sendMessage(conversationId, base, toolset)) {
          applyConversationUpdate(updated);
        }

        applyConversationUpdate.flush();
      } catch (err) {
        applyConversationUpdate.flush();

        const assistantError: UIMessage = {
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
        applyConversationUpdate.cancel();
        setStreaming(false);
      }
    },
    [toolset],
  );

  const handleSelectFile = useCallback((_: string) => {}, []);

  return (
    <>
      <ConversationAreaWithMessages
        streaming={streaming}
        canSend={hasCredentials() && !streaming}
        examplePrompts={examplePrompts}
        onSendMessage={handleSendMessage}
        onSelectFile={handleSelectFile}
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
