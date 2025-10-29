import type { ModelPricing } from "@/models";
import { Alert, Box, Button, Flex, Link, Stack, Text, VStack, type FlexProps } from "@chakra-ui/react";
import {
  ChangeBubble,
  ChatInput,
  ConversationMessages,
  EmptyState,
  generateEditorStateFromString,
  summarizeConversationChanges,
  type UIMessage,
} from "@pstdio/kas-ui";
import { useCallback, useMemo, useState } from "react";
import { CassetteTapeIcon } from "lucide-react";
import { ConversationContextUsage } from "./ConversationContextUsage";

const EMPTY_PROMPT_STATE = JSON.stringify(generateEditorStateFromString());

interface ConversationAreaProps extends FlexProps {
  messages: UIMessage[];
  streaming: boolean;
  onSendMessage?: (text: string, fileNames?: string[]) => void;
  onInterrupt?: () => void;
  onSelectFile?: (filePath: string) => void;
  onFileUpload?: () => Promise<string[] | undefined>;
  availableFiles?: Array<string>;
  canSend?: boolean;
  examplePrompts?: string[];
  credentialsReady: boolean;
  onOpenSettings?: () => void;
  modelPricing?: ModelPricing;
}

const ConversationPlaceholder = (props: {
  canSend: boolean;
  credentialsReady: boolean;
  examplePrompts: string[];
  onUseExample: (prompt: string) => void;
}) => {
  const { canSend, credentialsReady, examplePrompts, onUseExample } = props;
  const promptsToShow = examplePrompts.slice(0, 4);
  const showPrompts = credentialsReady && canSend && promptsToShow.length > 0;

  return (
    <Box w="100%">
      <EmptyState
        icon={<CassetteTapeIcon />}
        title="Welcome to the Kaset playground!"
        description="Kaset [ka'set] is an experimental open source toolkit to make your webapps agentic and customizable by your users."
      >
        <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
          Check out our{" "}
          <Link color="blue" href="https://kaset.dev">
            documentation
          </Link>
          .
        </Text>

        {showPrompts && (
          <VStack gap="sm" mt="sm" align="stretch">
            <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
              Try one of these example prompts to see what it can do:
            </Text>
            {promptsToShow.map((prompt) => (
              <Button key={prompt} variant="outline" size="sm" onClick={() => onUseExample(prompt)}>
                {prompt}
              </Button>
            ))}
          </VStack>
        )}
      </EmptyState>
    </Box>
  );
};

export const ConversationArea = (props: ConversationAreaProps) => {
  const {
    messages,
    streaming,
    onSendMessage,
    onInterrupt,
    onSelectFile,
    onFileUpload,
    availableFiles = [],
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
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const suggestions = useMemo(
    () =>
      examplePrompts.map((prompt, index) => ({
        id: String(index),
        summary: prompt,
        prompt,
      })),
    [examplePrompts],
  );

  const handleUseExample = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      onSendMessage?.(trimmed);
      setInputText("");
      setEditorRevision((revision) => revision + 1);
      setAttachedFiles([]);
    },
    [canSend, onSendMessage],
  );

  const handleInputChange = useCallback((value: string) => {
    setInputText(value);
  }, []);

  const handleSend = useCallback(
    (text: string, attachments: string[] = []) => {
      const trimmed = text.trim();
      if (!trimmed || !canSend) return;
      onSendMessage?.(trimmed, attachments);
      setInputText("");
      setEditorRevision((revision) => revision + 1);
    },
    [canSend, onSendMessage],
  );

  const handleAttachResource = useCallback((resourceId: string) => {
    setAttachedFiles((prev) => {
      if (prev.includes(resourceId)) return prev;
      return [...prev, resourceId];
    });
  }, []);

  const handleDetachResource = useCallback((resourceId: string) => {
    setAttachedFiles((prev) => prev.filter((id) => id !== resourceId));
  }, []);

  const handleClearAttachments = useCallback(() => {
    setAttachedFiles([]);
  }, []);

  const placeholder = useMemo(
    () => (
      <ConversationPlaceholder
        canSend={canSend}
        credentialsReady={credentialsReady}
        examplePrompts={examplePrompts}
        onUseExample={handleUseExample}
      />
    ),
    [canSend, credentialsReady, examplePrompts, handleUseExample],
  );

  const inputDisabled = !canSend && !streaming;

  return (
    <Flex position="relative" direction="column" w="full" h="full" overflow="hidden" {...rest}>
      <ConversationMessages
        messages={messages}
        streaming={streaming}
        onSelectFile={onSelectFile}
        placeholder={placeholder}
      />

      <Flex p="sm">
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

          <ChatInput
            key={editorRevision}
            defaultState={EMPTY_PROMPT_STATE}
            onSubmit={handleSend}
            onChange={handleInputChange}
            streaming={streaming}
            onFileUpload={onFileUpload}
            availableResources={availableFiles}
            attachedResources={attachedFiles}
            onAttachResource={handleAttachResource}
            onDetachResource={handleDetachResource}
            onSelectResource={onSelectFile}
            onClearAttachments={handleClearAttachments}
            isDisabled={inputDisabled}
            onInterrupt={onInterrupt}
          />
        </Stack>
      </Flex>
    </Flex>
  );
};
