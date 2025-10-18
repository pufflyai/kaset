import { ConversationContent, ConversationRoot, ConversationScrollButton } from "@/components/ui/ai-conversation";
import { ChangeBubble } from "@/components/ui/change-bubble";
import { SettingsModal } from "@/components/ui/settings-modal";
import { hasCredentials } from "@/state/actions/hasCredentials";
import { Alert, Button, Flex, HStack, Input, Stack, useDisclosure, type FlexProps } from "@chakra-ui/react";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { memo, useCallback, useMemo, useState } from "react";
import { summarizeConversationChanges } from "../utils/diff";
import { AutoScroll } from "./AutoScroll";
import { ConversationContextUsage } from "./ConversationContextUsage";
import { MessageList } from "./MessageList";

interface ConversationAreaProps extends FlexProps {
  messages: UIMessage[];
  streaming: boolean;
  onSendMessage?: (text: string, fileNames?: string[]) => void;
  onSelectFile?: (filePath: string) => void;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableFiles?: Array<string>;
  canSend?: boolean;
  examplePrompts?: string[];
}

interface ConversationMessagesProps {
  messages: UIMessage[];
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

  const settings = useDisclosure();
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

  const handleSend = () => {
    const text = input.trim();
    if (!text || !canSend) return;
    onSendMessage?.(text);
    setInput("");
  };

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
          <Flex w="full" align="center">
            {showChangeBubble && (
              <ChangeBubble
                additions={conversationChanges.additions}
                deletions={conversationChanges.deletions}
                fileCount={conversationChanges.fileCount}
                streaming={streaming}
              />
            )}
            <ConversationContextUsage messages={messages} input={input} />
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
