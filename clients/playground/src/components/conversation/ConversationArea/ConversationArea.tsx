import { ConversationContent, ConversationRoot, ConversationScrollButton } from "@/components/ui/ai-conversation";
import type { Message } from "@/types";
import { Button, Flex, HStack, Input, Stack, Text, type FlexProps } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { useEstimatedTokens } from "../hooks/useEstimatedTokens";
import { formatUSD, getModelPricing, type ModelPricing } from "@/models";
import { AutoScroll } from "./AutoScroll";
import { MessageList } from "./MessageList";

interface ConversationAreaProps extends FlexProps {
  messages: Message[];
  streaming: boolean;
  onSendMessage?: (text: string, fileNames?: string[]) => void;
  onSelectFile?: (filePath: string) => void;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableFiles?: Array<string>;
}

export const ConversationArea = (props: ConversationAreaProps) => {
  const { messages, streaming, onSendMessage, onSelectFile, ...rest } = props;
  const [input, setInput] = useState("");

  const estimatedTokens = useEstimatedTokens(messages, input);

  const [modelPricing, setModelPricing] = useState<ModelPricing | undefined>(undefined);

  // Load selected model from localStorage and resolve pricing
  // Only input tokens are known before sending; we price those
  // using the selected model's input token rate.
  // Falls back to tokens-only display if model is unknown.
  useEffect(() => {
    try {
      const mid = window.localStorage.getItem("tiny-ai-model");
      setModelPricing(getModelPricing(mid || undefined));
    } catch {
      setModelPricing(undefined);
    }
  }, []);
  

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSendMessage?.(text);
    setInput("");
  };

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden" {...rest}>
      <ConversationRoot>
        <AutoScroll userMessageCount={messages.reduce((count, m) => count + (m.role === "user" ? 1 : 0), 0)} />
        <ConversationContent>
          <MessageList messages={messages} streaming={streaming} onOpenFile={onSelectFile} />
        </ConversationContent>
        <ConversationScrollButton />
      </ConversationRoot>

      <Flex p="sm" borderTopWidth="1px" borderColor="border.secondary">
        <Stack direction="column" gap="2" width="full">
          <Flex w="full" justify="flex-end">
            <Text textStyle="label/XS" color="foreground.secondary">
              {estimatedTokens} tokens
              {modelPricing && (
                <>
                  {" "}·{" "}
                  {formatUSD((estimatedTokens / modelPricing.perTokens) * modelPricing.inputTokenCost)}
                </>
              )}
            </Text>
          </Flex>
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
          <HStack gap="2">
            <Button onClick={handleSend} disabled={!input.trim()}>
              Send
            </Button>
          </HStack>
        </Stack>
      </Flex>
    </Flex>
  );
};
