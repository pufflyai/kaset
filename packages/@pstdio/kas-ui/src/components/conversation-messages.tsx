import { AutoScroll } from "./auto-scroll";
import { ConversationContent, ConversationRoot, ConversationScrollButton } from "./ai-conversation";
import { MessageList, type MessageListProps } from "./message-list";
import { memo, type ReactNode } from "react";

export interface ConversationMessagesProps {
  messages: MessageListProps["messages"];
  streaming: MessageListProps["streaming"];
  onSelectFile?: MessageListProps["onOpenFile"];
  placeholder?: ReactNode;
}

export const ConversationMessages = memo(function ConversationMessages(props: ConversationMessagesProps) {
  const { messages, placeholder, streaming, onSelectFile } = props;
  const hasMessages = messages.length > 0;

  return (
    <ConversationRoot>
      <AutoScroll
        userMessageCount={messages.reduce((count, message) => count + (message.role === "user" ? 1 : 0), 0)}
      />
      <ConversationContent>
        {hasMessages ? (
          <MessageList messages={messages} streaming={streaming} onOpenFile={onSelectFile} />
        ) : (
          (placeholder ?? null)
        )}
      </ConversationContent>
      <ConversationScrollButton />
    </ConversationRoot>
  );
});
