import { memo, useMemo } from "react";
import type { ToolInvocation, UIMessage } from "../adapters/kas";
import { MessageContent, MessageRoot } from "./ai-message";
import { CollapsibleToolTimeline } from "./collapsible-tool-timeline";
import { MessagePartsRenderer } from "./message-parts-renderer";

const isToolOnlyMessage = (message: UIMessage) =>
  message.parts.length > 0 && message.parts.every((part: unknown) => (part as any).type === "tool-invocation");

function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const MemoMessagePartsRenderer = memo(MessagePartsRenderer);
const MemoCollapsibleToolTimeline = memo(CollapsibleToolTimeline);

const MessageRow = memo(
  function MessageRow(props: { message: UIMessage; isStreaming: boolean; onOpenFile?: (filePath: string) => void }) {
    const { isStreaming, message, onOpenFile } = props;
    return (
      <MessageRoot from={message.role as any}>
        <MessageContent>
          <MemoMessagePartsRenderer message={message} streaming={isStreaming} onOpenFile={onOpenFile} />
        </MessageContent>
      </MessageRoot>
    );
  },
  (prev, next) =>
    prev.message === next.message && prev.isStreaming === next.isStreaming && prev.onOpenFile === next.onOpenFile,
);

const ToolGroupRow = memo(
  function ToolGroupRow(props: {
    invocations: ToolInvocation[];
    completed: boolean;
    onOpenFile?: (filePath: string) => void;
  }) {
    const { completed, invocations, onOpenFile } = props;
    return (
      <MessageRoot from="assistant">
        <MessageContent>
          <MemoCollapsibleToolTimeline invocations={invocations} onOpenFile={onOpenFile} completed={completed} />
        </MessageContent>
      </MessageRoot>
    );
  },
  (prev, next) =>
    prev.completed === next.completed &&
    prev.onOpenFile === next.onOpenFile &&
    shallowArrayEqual(prev.invocations, next.invocations),
);

type RenderItem =
  | { kind: "message"; key: string; message: UIMessage }
  | { kind: "tool-group"; key: string; invocations: ToolInvocation[]; completed: boolean };

/**
 * Build a minimal render plan once per `messages` change.
 * - Groups contiguous assistant tool-only messages into one ToolGroupRow
 * - Keeps stable array/object identities across renders when `messages` is unchanged
 */
function useRenderPlan(messages: UIMessage[]): RenderItem[] {
  return useMemo(() => {
    const items: RenderItem[] = [];
    let i = 0;

    while (i < messages.length) {
      const message = messages[i];

      if (message.role === "assistant" && isToolOnlyMessage(message)) {
        const startId = message.id;
        const invocations: ToolInvocation[] = [];
        let j = i;

        while (j < messages.length && messages[j].role === "assistant" && isToolOnlyMessage(messages[j])) {
          for (const part of messages[j].parts as any[]) {
            invocations.push((part as any).toolInvocation as ToolInvocation);
          }
          j += 1;
        }

        const completed = j < messages.length; // another message follows the group
        items.push({
          kind: "tool-group",
          key: `tool-group-${startId}`,
          invocations,
          completed,
        });

        i = j;
      } else {
        items.push({ kind: "message", key: message.id, message });
        i += 1;
      }
    }

    return items;
  }, [messages]);
}

export interface MessageListProps {
  messages: UIMessage[];
  streaming: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function MessageList(props: MessageListProps) {
  const { messages, onOpenFile, streaming } = props;

  const plan = useRenderPlan(messages);
  const lastMessageId = messages.length ? messages[messages.length - 1].id : undefined;

  return plan.map((item) =>
    item.kind === "message" ? (
      <MessageRow
        key={item.key}
        message={item.message}
        isStreaming={Boolean(streaming && item.message.id === lastMessageId)}
        onOpenFile={onOpenFile}
      />
    ) : (
      <ToolGroupRow key={item.key} invocations={item.invocations} completed={item.completed} onOpenFile={onOpenFile} />
    ),
  );
}
