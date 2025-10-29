import type { Meta, StoryObj } from "@storybook/react";
import { Alert, Box, Button, Flex, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import { useCallback, useMemo, useState } from "react";
import { AutoScroll } from "../components/conversation/auto-scroll";
import { ChangeBubble } from "../components/change-bubble";
import { ConversationContent, ConversationRoot, ConversationScrollButton } from "../components/ai-conversation";
import { MessageList } from "../components/conversation/message-list";
import { summarizeConversationChanges } from "../conversation/diff";
import {
  emptyConversation,
  examplePrompts,
  streamingConversation,
  toolErrorConversation,
  toolInvocationConversation,
} from "./mocks/conversation";

interface ChatPlaygroundProps {
  messages: UIMessage[];
  streaming?: boolean;
  credentialsReady?: boolean;
  canSend?: boolean;
  examplePrompts?: string[];
}

const userMessagesCount = (messages: UIMessage[]): number => {
  return messages.reduce((count, message) => (message.role === "user" ? count + 1 : count), 0);
};

const ChatPlayground = (props: ChatPlaygroundProps) => {
  const {
    canSend = true,
    credentialsReady = true,
    examplePrompts: examplePromptOverrides,
    messages,
    streaming = false,
  } = props;
  const [input, setInput] = useState("");
  const prompts = examplePromptOverrides ?? examplePrompts;

  const conversationChanges = useMemo(() => summarizeConversationChanges(messages), [messages]);
  const showChangeBubble = conversationChanges.fileCount > 0;

  const handleUseExample = useCallback(
    (text: string) => {
      console.info("use example", text);
      if (!canSend) return;
      setInput(text);
    },
    [canSend],
  );

  const handleSend = useCallback(() => {
    if (!input.trim() || !canSend) return;
    console.info("send message", input.trim());
    setInput("");
  }, [canSend, input]);

  const handleOpenSettings = useCallback(() => {
    console.info("open settings");
  }, []);

  return (
    <Box width="960px" maxW="100%" height="640px">
      <Flex direction="column" height="full" borderWidth="1px" borderRadius="lg" overflow="hidden">
        <ConversationRoot>
          <AutoScroll userMessageCount={userMessagesCount(messages)} />
          <ConversationContent>
            <MessageList
              messages={messages}
              streaming={streaming}
              onUseExample={handleUseExample}
              examplePrompts={prompts}
              credentialsReady={credentialsReady}
            />
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to latest" />
        </ConversationRoot>

        <Flex padding="sm" borderTopWidth="1px" borderColor="border.secondary">
          <Stack direction="column" gap="sm" width="full">
            <Flex align="center" justify="space-between" gap="sm" wrap="wrap">
              {showChangeBubble ? (
                <ChangeBubble
                  additions={conversationChanges.additions}
                  deletions={conversationChanges.deletions}
                  fileCount={conversationChanges.fileCount}
                  streaming={streaming}
                />
              ) : (
                <Text textStyle="body/S" color="foreground.secondary">
                  No changes captured yet.
                </Text>
              )}
              <Text textStyle="body/XS" color="foreground.tertiary">
                {userMessagesCount(messages)} messages from you in this run.
              </Text>
            </Flex>

            {!credentialsReady ? (
              <Alert.Root status="warning">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title fontWeight="bold">Connection details missing</Alert.Title>
                  <Alert.Description>Add your API key or Base URL to enable chat.</Alert.Description>
                  <Button size="xs" variant="solid" onClick={handleOpenSettings}>
                    Open Settings
                  </Button>
                </Alert.Content>
              </Alert.Root>
            ) : null}

            <Stack direction="column" gap="xs">
              <Input
                placeholder="Type a message..."
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
              />
              <HStack gap="sm" justify="flex-end">
                <Button onClick={handleSend} disabled={!input.trim() || !canSend}>
                  Send message
                </Button>
              </HStack>
            </Stack>
          </Stack>
        </Flex>
      </Flex>
    </Box>
  );
};

const meta: Meta<typeof ChatPlayground> = {
  title: "Kas UI/Chat",
  component: ChatPlayground,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    messages: toolInvocationConversation,
    streaming: false,
    credentialsReady: true,
    canSend: true,
  },
};

export default meta;

type Story = StoryObj<typeof ChatPlayground>;

export const Default: Story = {};

export const Streaming: Story = {
  args: {
    messages: streamingConversation,
    streaming: true,
  },
};

export const Empty: Story = {
  args: {
    messages: emptyConversation,
  },
};

export const CredentialsRequired: Story = {
  args: {
    credentialsReady: false,
    messages: toolErrorConversation,
  },
};

export const ReadOnly: Story = {
  args: {
    canSend: false,
  },
};
