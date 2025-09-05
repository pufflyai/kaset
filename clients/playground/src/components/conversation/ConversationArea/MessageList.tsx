import { MessageContent, MessageRoot } from "@/components/ui/ai-message";
import { EmptyState } from "@/components/ui/empty-state";
import type { Message, ToolInvocation } from "@/types";
import { Box } from "@chakra-ui/react";
import { File as FileIcon } from "lucide-react";
import type { ReactNode } from "react";
import { CollapsibleToolTimeline } from "./CollapsibleToolTimeline";
import { MessagePartsRenderer } from "./MessagePartsRenderer";

export function MessageList({
  messages,
  streaming,
  onOpenFile,
}: {
  messages: Message[];
  streaming: boolean;
  onOpenFile?: (filePath: string) => void;
}) {
  const isToolOnlyMessage = (m: Message) =>
    m.parts.length > 0 && m.parts.every((p) => (p as any).type === "tool-invocation");

  const out: ReactNode[] = [];
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];

    if (message.role === "assistant" && isToolOnlyMessage(message)) {
      const invocations: ToolInvocation[] = [];
      const startId = message.id;
      let j = i;
      while (j < messages.length && messages[j].role === "assistant" && isToolOnlyMessage(messages[j])) {
        for (const p of messages[j].parts as any[]) {
          invocations.push((p as any).toolInvocation as ToolInvocation);
        }
        j += 1;
      }

      const groupKey = `tool-group-${startId}-${messages[j - 1].id}`;
      out.push(
        <MessageRoot from={"assistant"} key={groupKey}>
          <MessageContent>
            <CollapsibleToolTimeline
              invocations={invocations}
              onOpenFile={onOpenFile}
              completed={j < messages.length}
            />
          </MessageContent>
        </MessageRoot>,
      );

      i = j - 1;
      continue;
    }

    out.push(
      <MessageRoot from={message.role} key={message.id}>
        <MessageContent>
          <MessagePartsRenderer message={message} streaming={streaming} onOpenFile={onOpenFile} />
        </MessageContent>
      </MessageRoot>,
    );
  }

  if (!messages.length) {
    out.push(
      <Box key="empty" w="full">
        <EmptyState
          title="No messages yet"
          description="Start the conversation by sending a message."
          icon={<FileIcon size={16} />}
        />
      </Box>,
    );
  }

  return <>{out}</>;
}
