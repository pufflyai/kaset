import { ConversationContent, ConversationRoot, ConversationScrollButton } from "@/components/ui/ai-conversation";
import { ChangeBubble } from "@/components/ui/change-bubble";
import { SettingsModal } from "@/components/ui/settings-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { estimateInputCost, estimateOutputCost, formatUSD, getModelPricing, type ModelPricing } from "@/models";
import { hasCredentials } from "@/state/actions/hasCredentials";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Message } from "@/types";
import {
  Alert,
  Box,
  Button,
  Flex,
  HStack,
  Input,
  ProgressCircle,
  Stack,
  Text,
  useDisclosure,
  type FlexProps,
} from "@chakra-ui/react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { summarizeConversationChanges } from "../utils/diff";
import { useEstimatedTokens } from "../hooks/useEstimatedTokens";
import { AutoScroll } from "./AutoScroll";
import { MessageList } from "./MessageList";

interface ConversationAreaProps extends FlexProps {
  messages: Message[];
  streaming: boolean;
  onSendMessage?: (text: string, fileNames?: string[]) => void;
  onSelectFile?: (filePath: string) => void;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableFiles?: Array<string>;
  canSend?: boolean;
  examplePrompts?: string[];
}

interface ConversationMessagesProps {
  messages: Message[];
  streaming: boolean;
  onSelectFile?: (filePath: string) => void;
  onUseExample?: (text: string) => void;
  examplePrompts?: string[];
}

const ConversationMessages = memo(function ConversationMessages(props: ConversationMessagesProps) {
  const { messages, streaming, onSelectFile, onUseExample, examplePrompts } = props;

  return (
    <ConversationRoot>
      <AutoScroll userMessageCount={messages.reduce((count, m) => count + (m.role === "user" ? 1 : 0), 0)} />
      <ConversationContent>
        <MessageList
          messages={messages}
          streaming={streaming}
          onOpenFile={onSelectFile}
          examplePrompts={examplePrompts}
          onUseExample={onUseExample}
        />
      </ConversationContent>
      <ConversationScrollButton />
    </ConversationRoot>
  );
});

export const ConversationArea = (props: ConversationAreaProps) => {
  const { messages, streaming, onSendMessage, onSelectFile, canSend = true, examplePrompts = [], ...rest } = props;
  const [input, setInput] = useState("");

  const tokenUsage = useEstimatedTokens(messages, input);
  const totalTokens = tokenUsage.totalTokens;
  const conversationTotalTokens = tokenUsage.conversationTotalTokens;
  const conversationPromptTokens = tokenUsage.conversationPromptTokens;

  const [modelPricing, setModelPricing] = useState<ModelPricing | undefined>(undefined);
  const modelId = useWorkspaceStore((s) => s.settings.modelId);
  const settings = useDisclosure();
  const [usageTooltipOpen, setUsageTooltipOpen] = useState(false);
  const conversationChanges = useMemo(() => summarizeConversationChanges(messages), [messages]);
  const showChangeBubble = conversationChanges.fileCount > 0;
  const handleUseExample = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      onSendMessage?.(trimmed);
      setInput("");
    },
    [canSend, onSendMessage, setInput],
  );

  // Load selected model from localStorage and resolve pricing
  // Only input tokens are known before sending; we price those
  // using the selected model's input token rate.
  // Falls back to tokens-only display if model is unknown.
  useEffect(() => {
    setModelPricing(getModelPricing(modelId || undefined));
  }, [modelId]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !canSend) return;
    onSendMessage?.(text);
    setInput("");
    setUsageTooltipOpen(false);
  };

  const totalTokensDisplay = totalTokens.toLocaleString();
  const conversationTokensDisplay = conversationTotalTokens.toLocaleString();
  const conversationPromptDisplay = conversationPromptTokens.toLocaleString();
  const contextTokenUsage = conversationPromptTokens > 0 ? conversationPromptTokens : conversationTotalTokens;
  const contextTokenUsageDisplay = contextTokenUsage.toLocaleString();

  const totalCost = modelPricing
    ? estimateInputCost(tokenUsage.promptTokens, modelPricing) +
      estimateOutputCost(tokenUsage.completionTokens, modelPricing)
    : undefined;

  const contextWindowTokens = modelPricing?.contextWindow;
  const contextUsagePercent =
    contextWindowTokens && contextWindowTokens > 0 ? Math.min((contextTokenUsage / contextWindowTokens) * 100, 100) : 0;

  const contextPercentLabel = (() => {
    if (contextUsagePercent === 0) return "0%";
    if (contextUsagePercent >= 10) return `${Math.round(contextUsagePercent)}%`;
    if (contextUsagePercent >= 1) return `${contextUsagePercent.toFixed(1)}%`;
    return `${contextUsagePercent.toFixed(2)}%`;
  })();

  const tooltipContent = (
    <Stack gap="2xs" textStyle="body/XS">
      {contextWindowTokens !== undefined && (
        <Text>
          Context {contextTokenUsageDisplay} / {contextWindowTokens.toLocaleString()} tokens ({contextPercentLabel})
        </Text>
      )}
      <Text>Prompt tokens {conversationPromptDisplay}</Text>
      <Text>Conversation tokens {conversationTokensDisplay}</Text>
      <Text>Total tokens {totalTokensDisplay}</Text>
      {totalCost !== undefined && <Text>Cost {formatUSD(totalCost)}</Text>}
    </Stack>
  );

  const handleUsageTooltipToggle = useCallback(() => {
    setUsageTooltipOpen((open) => !open);
  }, []);

  const handleUsageTooltipOpenChange = useCallback((details: { open: boolean }) => {
    setUsageTooltipOpen(details.open);
  }, []);

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden" {...rest}>
      <ConversationMessages
        messages={messages}
        streaming={streaming}
        onSelectFile={onSelectFile}
        onUseExample={handleUseExample}
        examplePrompts={examplePrompts}
      />

      <Flex p="sm" borderTopWidth="1px" borderColor="border.secondary">
        <Stack direction="column" gap="sm" width="full">
          <Flex w="full" justify="flex-end">
            <Tooltip
              showArrow
              open={usageTooltipOpen}
              onOpenChange={handleUsageTooltipOpenChange}
              closeOnPointerDown={false}
              openDelay={0}
              closeDelay={0}
              content={tooltipContent}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={handleUsageTooltipToggle}
                minW="unset"
                p="0"
                borderRadius="full"
                aria-label="Show token usage"
              >
                <Box px="xs" py="2xs">
                  <ProgressCircle.Root value={contextUsagePercent} max={100} boxSize="36px">
                    <ProgressCircle.Circle>
                      <ProgressCircle.Track />
                      <ProgressCircle.Range />
                    </ProgressCircle.Circle>
                    <ProgressCircle.ValueText textStyle="label/XS">{contextPercentLabel}</ProgressCircle.ValueText>
                  </ProgressCircle.Root>
                </Box>
              </Button>
            </Tooltip>
          </Flex>
          {!hasCredentials() && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title fontWeight="bold">Connection details missing</Alert.Title>
                <Alert.Description>Add your API key or set a Base URL to enable chat.</Alert.Description>
                <Button size="xs" variant="solid" onClick={settings.onOpen}>
                  Open Settings
                </Button>
              </Alert.Content>
            </Alert.Root>
          )}
          {showChangeBubble && (
            <Flex justify="flex-end">
              <ChangeBubble
                additions={conversationChanges.additions}
                deletions={conversationChanges.deletions}
                fileCount={conversationChanges.fileCount}
                streaming={streaming}
              />
            </Flex>
          )}
          <Input
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <HStack gap="sm">
            <Button onClick={handleSend} disabled={!input.trim() || !canSend}>
              Send
            </Button>
          </HStack>
        </Stack>
      </Flex>
      <SettingsModal isOpen={settings.open} onClose={settings.onClose} />
    </Flex>
  );
};
