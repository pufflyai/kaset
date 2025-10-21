import {
  appendConversationMessages,
  getConversation,
  getConversationMessages,
  getSelectedConversationId,
  setConversationMessages,
  updateChatSettings,
  useConversationStore,
} from "@/kas-ui";
import { setApprovalHandler } from "@/services/ai/approval";
import { useMcpService } from "@/services/mcp/useMcpService";
import type { ApprovalRequest } from "@pstdio/kas";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { shortUID } from "@pstdio/prompt-utils";
import { usePluginHost } from "@pstdio/tiny-plugins";
import debounce from "lodash/debounce";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDisclosure } from "@chakra-ui/react";
import { examplePrompts } from "../../constant";
import { sendMessage } from "../../services/ai/sendMessage";
import { host } from "../../services/plugins/host";
import { ConversationArea } from "../conversation/ConversationArea";
import { ApprovalModal } from "./approval-modal";
import { SettingsModal } from "./settings-modal";

const EMPTY_MESSAGES: UIMessage[] = [];
const ASSISTANT_UPDATE_DEBOUNCE_MS = 400;
const ASSISTANT_UPDATE_MAX_WAIT_MS = 1200;

interface ConversationAreaWithMessagesProps {
  streaming: boolean;
  examplePrompts: string[];
  onSendMessage: (text: string, fileNames?: string[]) => void | Promise<void>;
  onSelectFile?: (filePath: string) => void;
}

const ConversationAreaWithMessages = memo(function ConversationAreaWithMessages(
  props: ConversationAreaWithMessagesProps,
) {
  const { streaming, examplePrompts, onSendMessage, onSelectFile } = props;
  const messages = useConversationStore((state) => {
    const id = state.selectedConversationId;
    return id ? (state.conversations[id]?.messages ?? EMPTY_MESSAGES) : EMPTY_MESSAGES;
  });
  const chatSettings = useConversationStore((state) => state.chatSettings);
  const canSend = chatSettings.credentialsReady && !streaming;

  return (
    <ConversationArea
      messages={messages}
      streaming={streaming}
      canSend={canSend}
      examplePrompts={examplePrompts}
      onSendMessage={onSendMessage}
      onSelectFile={onSelectFile}
      credentialsReady={chatSettings.credentialsReady}
      onOpenSettings={chatSettings.onOpenSettings}
      modelId={chatSettings.modelId}
      modelPricing={chatSettings.modelPricing}
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
  const settings = useDisclosure();
  const chatConfig = useConversationStore((state) => ({
    modelId: state.chatSettings.modelId,
    apiKey: state.chatSettings.apiKey,
    baseUrl: state.chatSettings.baseUrl,
    approvalGatedTools: state.chatSettings.approvalGatedTools,
  }));
  const { modelId, apiKey, baseUrl, approvalGatedTools } = chatConfig;

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

  useEffect(() => {
    updateChatSettings({ onOpenSettings: settings.onOpen });
    return () => {
      updateChatSettings({ onOpenSettings: undefined });
    };
  }, [settings.onOpen]);

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
          setConversationMessages(conversationId, nextMessages);
        },
        ASSISTANT_UPDATE_DEBOUNCE_MS,
        { leading: true, trailing: true, maxWait: ASSISTANT_UPDATE_MAX_WAIT_MS },
      );

      setConversationMessages(conversationId, base);

      try {
        setStreaming(true);
        for await (const updated of sendMessage(conversationId, base, {
          tools: toolset,
          chatSettings: {
            modelId,
            apiKey,
            baseUrl,
            approvalGatedTools,
          },
        })) {
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
          appendConversationMessages(id, [assistantError]);
        }
      } finally {
        applyConversationUpdate.cancel();
        setStreaming(false);
      }
    },
    [toolset, modelId, apiKey, baseUrl, approvalGatedTools],
  );

  const handleSelectFile = useCallback((_: string) => {}, []);

  return (
    <>
      <ConversationAreaWithMessages
        streaming={streaming}
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
      <SettingsModal isOpen={settings.open} onClose={settings.onClose} />
    </>
  );
}
