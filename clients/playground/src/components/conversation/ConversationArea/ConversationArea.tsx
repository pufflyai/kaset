import { ConversationContent, ConversationRoot, ConversationScrollButton } from "@/components/ui/ai-conversation";
import { SettingsModal } from "@/components/ui/settings-modal";
import { formatUSD, getModelPricing, type ModelPricing } from "@/models";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Message } from "@/types";
import { Alert, Button, Flex, HStack, Input, Stack, Text, Textarea, useDisclosure, type FlexProps } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useEstimatedTokens } from "../hooks/useEstimatedTokens";
import { AutoScroll } from "./AutoScroll";
import { MessageList } from "./MessageList";
import { useIsMobile } from "@/hooks/useIsMobile";

interface ConversationAreaProps extends FlexProps {
  messages: Message[];
  streaming: boolean;
  onSendMessage?: (text: string, fileNames?: string[]) => void;
  onSelectFile?: (filePath: string) => void;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableFiles?: Array<string>;
  canSend?: boolean;
}

export const ConversationArea = (props: ConversationAreaProps) => {
  const { messages, streaming, onSendMessage, onSelectFile, canSend = true, ...rest } = props;
  const [input, setInput] = useState("");
  const isMobile = useIsMobile();

  const estimatedTokens = useEstimatedTokens(messages, input);

  const [modelPricing, setModelPricing] = useState<ModelPricing | undefined>(undefined);
  const modelId = useWorkspaceStore((s) => s.modelId);
  const hasKey = useWorkspaceStore((s) => !!s.apiKey);
  const settings = useDisclosure();

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

  const tokenSummary = modelPricing
    ? `${estimatedTokens} tokens · ${formatUSD((estimatedTokens / modelPricing.perTokens) * modelPricing.inputTokenCost)}`
    : `${estimatedTokens} tokens`;

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden" {...rest}>
      <ConversationRoot>
        <AutoScroll userMessageCount={messages.reduce((count, m) => count + (m.role === "user" ? 1 : 0), 0)} />
        <ConversationContent>
          <MessageList
            messages={messages}
            streaming={streaming}
            onOpenFile={onSelectFile}
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

      <Flex p={isMobile ? "md" : "sm"} borderTopWidth="1px" borderColor="border.secondary">
        <Stack direction="column" gap="sm" width="full">
          <Flex w="full" justify={isMobile ? "flex-start" : "flex-end"}>
            <Text
              textStyle="label/XS"
              color="foreground.secondary"
              fontSize={isMobile ? "sm" : undefined}
              textAlign={isMobile ? "left" : "right"}
              width="full"
            >
              {tokenSummary}
            </Text>
          </Flex>
          {!hasKey && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title fontWeight="bold">API key missing</Alert.Title>
                <Alert.Description>Add your API key to enable chat.</Alert.Description>
                <Button size={isMobile ? "md" : "xs"} variant="solid" onClick={settings.onOpen}>
                  Open Settings
                </Button>
              </Alert.Content>
            </Alert.Root>
          )}
          {isMobile ? (
            <Stack direction="column" gap="sm">
              <Textarea
                placeholder="Type a message..."
                value={input}
                minH="96px"
                resize="vertical"
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                alignSelf="flex-end"
                minHeight="44px"
                size="md"
                onClick={handleSend}
                disabled={!input.trim() || !canSend}
              >
                Send
              </Button>
            </Stack>
          ) : (
            <>
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
            </>
          )}
        </Stack>
      </Flex>
      <SettingsModal isOpen={settings.open} onClose={settings.onClose} />
    </Flex>
  );
};
