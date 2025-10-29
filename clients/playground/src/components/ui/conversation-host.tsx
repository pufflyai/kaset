import { getModelPricing, type ModelPricing } from "@/models";
import { setApprovalHandler } from "@/services/ai/approval";
import { useMcpService } from "@/services/mcp/useMcpService";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import { useDisclosure } from "@chakra-ui/react";
import type { ApprovalRequest } from "@pstdio/kas";
import {
  appendConversationMessages,
  getConversation,
  getConversationMessages,
  getSelectedConversationId,
  setConversationMessages,
  setConversationStreaming,
  useConversationStore,
  type ToolInvocationUIPart,
  type UIMessage,
} from "@pstdio/kas-ui";
import { shortUID } from "@pstdio/prompt-utils";
import { usePluginHost } from "@pstdio/tiny-plugins";
import debounce from "lodash/debounce";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DebouncedFunc } from "lodash";
import { examplePrompts } from "../../constant";
import { sendMessage } from "../../services/ai/sendMessage";
import { host } from "../../services/plugins/host";
import { ConversationArea } from "../conversation/ConversationArea";
import { ApprovalModal } from "./approval-modal";
import { SettingsModal } from "./settings-modal";

const EMPTY_MESSAGES: UIMessage[] = [];
const ASSISTANT_UPDATE_DEBOUNCE_MS = 400;
const ASSISTANT_UPDATE_MAX_WAIT_MS = 1200;

type ActiveStream = {
  conversationId: string;
  iterator: AsyncGenerator<UIMessage[], void, unknown>;
  applyConversationUpdate: DebouncedFunc<(nextMessages: UIMessage[]) => void>;
};

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
  canSend: boolean;
  examplePrompts: string[];
  onSendMessage: (text: string, fileNames?: string[]) => void | Promise<void>;
  onInterrupt?: () => void | Promise<void>;
  onSelectFile?: (filePath: string) => void;
  credentialsReady: boolean;
  modelPricing?: ModelPricing;
  onOpenSettings?: () => void;
}

const ConversationAreaWithMessages = memo(function ConversationAreaWithMessages(
  props: ConversationAreaWithMessagesProps,
) {
  const {
    canSend,
    examplePrompts,
    onSendMessage,
    onInterrupt,
    onSelectFile,
    credentialsReady,
    modelPricing,
    onOpenSettings,
  } = props;
  const streaming = useConversationStore((s) => {
    const id = s.selectedConversationId;
    if (!id) return false;

    const conversation = s.conversations[id];
    return conversation?.streaming ?? false;
  });
  const messages = useConversationStore((s) =>
    s.selectedConversationId ? (s.conversations[s.selectedConversationId]?.messages ?? EMPTY_MESSAGES) : EMPTY_MESSAGES,
  );

  return (
    <ConversationArea
      messages={messages}
      streaming={streaming}
      canSend={canSend}
      examplePrompts={examplePrompts}
      onSendMessage={onSendMessage}
      onInterrupt={onInterrupt}
      onSelectFile={onSelectFile}
      credentialsReady={credentialsReady}
      modelPricing={modelPricing}
      onOpenSettings={onOpenSettings}
    />
  );
});

export function ConversationHost() {
  const { tools: mcpTools } = useMcpService();
  const { tools: pluginTools } = usePluginHost(host);
  const streaming = useConversationStore((s) => {
    const id = s.selectedConversationId;
    if (!id) return false;

    const conversation = s.conversations[id];
    return conversation?.streaming ?? false;
  });
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const approvalResolve = useRef<((ok: boolean) => void) | null>(null);
  const activeStreamRef = useRef<ActiveStream | null>(null);
  const toolset = useMemo(() => [...pluginTools, ...mcpTools], [pluginTools, mcpTools]);
  const settings = useDisclosure();
  const apiKey = useWorkspaceStore((s) => s.settings.apiKey);
  const baseUrl = useWorkspaceStore((s) => s.settings.baseUrl);
  const modelId = useWorkspaceStore((s) => s.settings.modelId);
  const credentialsReady = Boolean(apiKey || baseUrl);
  const modelPricing = useMemo(() => getModelPricing(modelId), [modelId]);

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
          setConversationMessages(conversationId, nextMessages);
        },
        ASSISTANT_UPDATE_DEBOUNCE_MS,
        { leading: true, trailing: true, maxWait: ASSISTANT_UPDATE_MAX_WAIT_MS },
      );

      setConversationMessages(conversationId, base);

      const iterator = sendMessage(conversationId, base, toolset);
      activeStreamRef.current = {
        conversationId,
        iterator,
        applyConversationUpdate,
      };

      try {
        setConversationStreaming(conversationId, true);
        for await (const updated of iterator) {
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

          setConversationMessages(id, updatedMessages);
          appendConversationMessages(id, [assistantError]);
        }
      } finally {
        if (activeStreamRef.current?.iterator === iterator) {
          activeStreamRef.current = null;
        }
        applyConversationUpdate.cancel();
        setConversationStreaming(conversationId, false);
      }
    },
    [toolset],
  );

  const handleInterrupt = useCallback(async () => {
    const active = activeStreamRef.current;
    if (!active) return;

    activeStreamRef.current = null;

    const { iterator, applyConversationUpdate, conversationId } = active;

    applyConversationUpdate.flush();

    if (typeof iterator.return === "function") {
      try {
        await iterator.return();
      } catch (error) {
        console.warn("Failed to stop conversation stream", error);
      }
    }

    applyConversationUpdate.cancel();
    setConversationStreaming(conversationId, false);
  }, []);

  const handleSelectFile = useCallback((_: string) => {}, []);

  return (
    <>
      <ConversationAreaWithMessages
        canSend={credentialsReady && !streaming}
        examplePrompts={examplePrompts}
        onSendMessage={handleSendMessage}
        onInterrupt={handleInterrupt}
        onSelectFile={handleSelectFile}
        credentialsReady={credentialsReady}
        modelPricing={modelPricing}
        onOpenSettings={settings.onOpen}
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
