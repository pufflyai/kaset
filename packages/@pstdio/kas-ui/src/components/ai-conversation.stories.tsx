import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { ConversationContent, ConversationRoot, ConversationScrollButton } from "./ai-conversation";
import { MessageList } from "./message-list";
import type { UIMessage } from "../adapters/kas";
import {
  emptyConversation,
  streamingConversation,
  toolErrorConversation,
  toolInvocationConversation,
} from "../mocks/conversation";

interface ConversationExampleProps {
  messages: UIMessage[];
  streaming?: boolean;
}

const onOpenFile = (value: string) => {
  console.info("onOpenFile", value);
};

const ConversationExample = (props: ConversationExampleProps) => {
  const { messages, streaming = false } = props;
  const hasMessages = messages.length > 0;

  return (
    <Box width="960px" maxW="100%" height="600px" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <ConversationRoot>
        <ConversationContent>
          {hasMessages ? (
            <MessageList messages={messages} streaming={streaming} onOpenFile={onOpenFile} />
          ) : (
            <Box p="lg" textAlign="center" color="fg.muted">
              No messages yet.
            </Box>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to bottom" />
      </ConversationRoot>
    </Box>
  );
};

const meta: Meta<typeof ConversationExample> = {
  title: "Components/Conversation",
  component: ConversationExample,
  args: {
    messages: emptyConversation,
    streaming: false,
  },
};

export default meta;

type Story = StoryObj<typeof ConversationExample>;

export const Empty: Story = {};

export const Streaming: Story = {
  args: {
    messages: streamingConversation,
    streaming: true,
  },
};

export const ToolExecution: Story = {
  args: {
    messages: toolInvocationConversation,
  },
};

export const ToolError: Story = {
  args: {
    messages: toolErrorConversation,
  },
};
