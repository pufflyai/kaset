import {
  AutoScroll,
  ChangeBubble,
  ConversationContent,
  ConversationRoot,
  ConversationScrollButton,
  MessageList,
  PromptEditor,
  generateEditorStateFromString,
  summarizeConversationChanges,
} from "@pstdio/kas-ui";
import type { ModelPricing } from "@/models";
import { Alert, Button, Flex, HStack, Stack, type FlexProps } from "@chakra-ui/react";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { memo, useCallback, useMemo, useState } from "react";
import { ConversationContextUsage } from "./ConversationContextUsage";

const EMPTY_PROMPT_STATE = JSON.stringify(generateEditorStateFromString());

interface ConversationAreaProps extends FlexProps {
  messages: UIMessage[];
  streaming: boolean;
  onSendMessage?: (text: string, fileNames?: string[]) => void;
  onSelectFile?: (filePath: string) => void;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableFiles?: Array<string>;
  canSend?: boolean;
  examplePrompts?: string[];
  credentialsReady: boolean;
  onOpenSettings?: () => void;
  modelPricing?: ModelPricing;
}

interface ConversationMessagesProps {
  messages: UIMessage[];
  streaming: boolean;
  onSelectFile?: (filePath: string) => void;
  onUseExample?: (text: string) => void;
  examplePrompts?: string[];
  credentialsReady: boolean;
}

const ConversationMessages = memo(function ConversationMessages(props: ConversationMessagesProps) {
  const { messages, streaming, onSelectFile, onUseExample, examplePrompts, credentialsReady } = props;

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
          credentialsReady={credentialsReady}
        />
      </ConversationContent>
      <ConversationScrollButton />
    </ConversationRoot>
  );
});

export const ConversationArea = (props: ConversationAreaProps) => {
  const {
    messages,
    streaming,
    onSendMessage,
    onSelectFile,
    canSend = true,
    examplePrompts = [],
    credentialsReady,
    onOpenSettings,
    modelPricing,
    ...rest
  } = props;
  const [inputText, setInputText] = useState("");
  const [editorRevision, setEditorRevision] = useState(0);
  const conversationChanges = useMemo(() => summarizeConversationChanges(messages), [messages]);
  const showChangeBubble = conversationChanges.fileCount > 0;

  const handleUseExample = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      onSendMessage?.(trimmed);
      setInputText("");
      setEditorRevision((revision) => revision + 1);
    },
    [canSend, onSendMessage],
  );

  const handleEditorChange = useCallback((text: string) => {
    setInputText(text);
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !canSend) return;
    onSendMessage?.(text);
    setInputText("");
    setEditorRevision((revision) => revision + 1);
  }, [canSend, inputText, onSendMessage]);

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden" {...rest}>
      <ConversationMessages
        messages={messages}
        streaming={streaming}
        onSelectFile={onSelectFile}
        onUseExample={handleUseExample}
        examplePrompts={examplePrompts}
        credentialsReady={credentialsReady}
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
            <ConversationContextUsage messages={messages} input={inputText} modelPricing={modelPricing} />
          </Flex>

          {!credentialsReady && (
            <Alert.Root status="warning">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title fontWeight="bold">Connection details missing</Alert.Title>
                <Alert.Description>Add your API key or set a Base URL to enable chat.</Alert.Description>
                <Button size="xs" variant="solid" onClick={onOpenSettings}>
                  Open Settings
                </Button>
              </Alert.Content>
            </Alert.Root>
          )}

          <PromptEditor
            key={editorRevision}
            defaultState={EMPTY_PROMPT_STATE}
            isEditable
            onChange={handleEditorChange}
            onSubmit={handleSend}
          />
          <HStack gap="sm">
            <Button onClick={handleSend} disabled={!inputText.trim() || !canSend}>
              Send
            </Button>
          </HStack>
        </Stack>
      </Flex>
    </Flex>
  );
};
