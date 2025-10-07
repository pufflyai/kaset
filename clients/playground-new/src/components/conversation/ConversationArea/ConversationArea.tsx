import { ConversationContent, ConversationRoot, ConversationScrollButton } from "@/components/ui/ai-conversation";
import { ChangeBubble } from "@/components/ui/change-bubble";
import { SettingsModal } from "@/components/ui/settings-modal";
import { formatUSD, getModelPricing, type ModelPricing } from "@/models";
import { hasCredentials } from "@/state/actions/hasCredentials";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Message } from "@/types";
import { Alert, Button, Flex, HStack, Input, Stack, Text, useDisclosure, type FlexProps } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
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

export const ConversationArea = (props: ConversationAreaProps) => {
  const { messages, streaming, onSendMessage, onSelectFile, canSend = true, examplePrompts = [], ...rest } = props;
  const [input, setInput] = useState("");

  const estimatedTokens = useEstimatedTokens(messages, input);

  const [modelPricing, setModelPricing] = useState<ModelPricing | undefined>(undefined);
  const modelId = useWorkspaceStore((s) => s.settings.modelId);
  const settings = useDisclosure();
  const conversationChanges = useMemo(() => summarizeConversationChanges(messages), [messages]);
  const showChangeBubble = conversationChanges.fileCount > 0;

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
  };

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden" {...rest}>
      <ConversationRoot>
        <AutoScroll userMessageCount={messages.reduce((count, m) => count + (m.role === "user" ? 1 : 0), 0)} />
        <ConversationContent>
          <MessageList
            messages={messages}
            streaming={streaming}
            onOpenFile={onSelectFile}
            examplePrompts={examplePrompts}
            onUseExample={(text) => {
              const trimmed = text.trim();
              if (!trimmed || !canSend) return;
              onSendMessage?.(trimmed);
              setInput("");
            }}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </ConversationRoot>

      <Flex p="sm" borderTopWidth="1px" borderColor="border.secondary">
        <Stack direction="column" gap="sm" width="full">
          <Flex w="full" justify="flex-end">
            <Text textStyle="label/XS" color="foreground.secondary">
              {estimatedTokens} tokens
              {modelPricing && (
                <> · {formatUSD((estimatedTokens / modelPricing.perTokens) * modelPricing.inputTokenCost)}</>
              )}
            </Text>
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
