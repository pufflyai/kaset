import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@chakra-ui/react";
import { ConversationContent, ConversationRoot, ConversationScrollButton } from "../components/ai-conversation";
import { MessageList } from "../components/conversation/message-list";
import type { UIMessage } from "@pstdio/kas/kas-ui";
import {
  emptyConversation,
  streamingConversation,
  toolErrorConversation,
  toolInvocationConversation,
  examplePrompts,
} from "./mocks/conversation";

interface ConversationExampleProps {
  messages: UIMessage[];
  streaming?: boolean;
  credentialsReady?: boolean;
}

const onUseExample = (value: string) => {
  // eslint-disable-next-line no-console
  console.info("onUseExample", value);
};

const onOpenFile = (value: string) => {
  // eslint-disable-next-line no-console
  console.info("onOpenFile", value);
};

const ConversationExample = (props: ConversationExampleProps) => {
  const { credentialsReady = true, messages, streaming = false } = props;

  return (
    <Box width="960px" maxW="100%" height="600px" borderWidth="1px" borderRadius="lg" overflow="hidden">
      <ConversationRoot>
        <ConversationContent>
          <MessageList
            messages={messages}
            streaming={streaming}
            credentialsReady={credentialsReady}
            examplePrompts={examplePrompts}
            onUseExample={onUseExample}
            onOpenFile={onOpenFile}
          />
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to bottom" />
      </ConversationRoot>
    </Box>
  );
};

const meta: Meta<typeof ConversationExample> = {
  title: "Kas UI/Conversation",
  component: ConversationExample,
  args: {
    messages: emptyConversation,
    streaming: false,
    credentialsReady: true,
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
