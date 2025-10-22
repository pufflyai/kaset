import { setApprovalHandler } from "@/services/ai/approval";
import { useMcpService } from "@/services/mcp/useMcpService";
import { appendConversationMessages } from "@/state/actions/appendConversationMessages";
import { getConversation } from "@/state/actions/getConversation";
import { getConversationMessages } from "@/state/actions/getConversationMessages";
import { getSelectedConversationId } from "@/state/actions/getSelectedConversationId";
import { hasCredentials } from "@/state/actions/hasCredentials";
import { setConversationMessages } from "@/state/actions/setConversationMessages";
import type { ApprovalRequest } from "@pstdio/kas";
import type { ToolInvocationUIPart, UIMessage } from "@pstdio/kas/kas-ui";
import { shortUID } from "@pstdio/prompt-utils";
import { usePluginHost } from "@pstdio/tiny-plugins";
import debounce from "lodash/debounce";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { examplePrompts } from "../../constant";
import { sendMessage } from "../../services/ai/sendMessage";
import { host } from "../../services/plugins/host";
import { useWorkspaceStore } from "../../state/WorkspaceProvider";
import { ConversationArea } from "../conversation/ConversationArea";
import { ApprovalModal } from "./approval-modal";

const EMPTY_MESSAGES: UIMessage[] = [];
const ASSISTANT_UPDATE_DEBOUNCE_MS = 400;
const ASSISTANT_UPDATE_MAX_WAIT_MS = 1200;

function markInFlightToolInvocationsAsError(messages: UIMessage[], errorText: string) {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    let changed = false;
    const parts = message.parts.map((part) => {
      if ((part as ToolInvocationUIPart).type !== "tool-invocation") return part;

      const toolPart = part as ToolInvocationUIPart;
      const toolInvocation = toolPart.toolInvocation;
      if (!("state" in toolInvocation)) return part;

      const state = toolInvocation.state;

      if (state !== "input-available" && state !== "input-streaming") return part;

      changed = true;
      return {
        ...toolPart,
        toolInvocation: {
          ...toolInvocation,
          state: "output-error",
          errorText,
          providerExecuted: false,
        },
      } satisfies ToolInvocationUIPart;
    });

    if (!changed) return message;

    return {
      ...message,
      parts,
    };
  });
}

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
  const { tools: pluginTools } = usePluginHost(host);
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
        ASSISTANT_UPDATE_DEBOUNCE_MS,
        { leading: true, trailing: true, maxWait: ASSISTANT_UPDATE_MAX_WAIT_MS },
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

        const errorText = err instanceof Error ? err.message : String(err);
        const assistantError: UIMessage = {
          id: shortUID(),
          role: "assistant",
          parts: [
            {
              type: "text",
              text: `Sorry, I couldn't process that. ${errorText}`,
            },
          ],
        };

        const id = getSelectedConversationId();
        if (id) {
          const latestMessages = getConversationMessages(id);
          const updatedMessages = markInFlightToolInvocationsAsError(latestMessages, errorText);

          setConversationMessages(id, updatedMessages, "conversations/send/error");
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
