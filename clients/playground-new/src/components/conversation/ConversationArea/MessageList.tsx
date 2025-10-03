import { MessageContent, MessageRoot } from "@/components/ui/ai-message";
import { EmptyState } from "@/components/ui/empty-state";
import { hasCredentials } from "@/state/actions/hasCredentials";
import type { Message, ToolInvocation } from "@/types";
import { Box, Button, Link, Text, VStack } from "@chakra-ui/react";
import { CassetteTapeIcon } from "lucide-react";
import { memo, useCallback, useMemo } from "react";
import { CollapsibleToolTimeline } from "./CollapsibleToolTimeline";
import { MessagePartsRenderer } from "./MessagePartsRenderer";

const isToolOnlyMessage = (m: Message) =>
  m.parts.length > 0 && m.parts.every((p) => (p as any).type === "tool-invocation");

function pickRandom<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function shallowArrayEqual<T>(a: readonly T[], b: readonly T[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const MemoMessagePartsRenderer = memo(MessagePartsRenderer);
const MemoCollapsibleToolTimeline = memo(CollapsibleToolTimeline);

const MessageRow = memo(
  function MessageRow({
    message,
    isStreaming,
    onOpenFile,
  }: {
    message: Message;
    isStreaming: boolean;
    onOpenFile?: (filePath: string) => void;
  }) {
    return (
      <MessageRoot from={message.role}>
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
  function ToolGroupRow({
    invocations,
    completed,
    onOpenFile,
  }: {
    invocations: ToolInvocation[];
    completed: boolean;
    onOpenFile?: (filePath: string) => void;
  }) {
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
  | { kind: "message"; key: string; message: Message }
  | { kind: "tool-group"; key: string; invocations: ToolInvocation[]; completed: boolean };

/**
 * Build a minimal render plan once per `messages` change.
 * - Groups contiguous assistant tool-only messages into one ToolGroupRow
 * - Keeps stable array/object identities across renders when `messages` is unchanged
 */
function useRenderPlan(messages: Message[]): RenderItem[] {
  return useMemo(() => {
    const items: RenderItem[] = [];
    let i = 0;

    while (i < messages.length) {
      const m = messages[i];

      if (m.role === "assistant" && isToolOnlyMessage(m)) {
        const startId = m.id;
        const invocations: ToolInvocation[] = [];
        let j = i;

        while (j < messages.length && messages[j].role === "assistant" && isToolOnlyMessage(messages[j])) {
          for (const p of messages[j].parts as any[]) {
            invocations.push((p as any).toolInvocation as ToolInvocation);
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
        items.push({ kind: "message", key: m.id, message: m });
        i += 1;
      }
    }

    return items;
  }, [messages]);
}

interface MessageListProps {
  messages: Message[];
  streaming: boolean;
  onOpenFile?: (filePath: string) => void;
  onUseExample?: (text: string) => void;
}

export function MessageList({ messages, streaming, onOpenFile, onUseExample }: MessageListProps) {
  const projectPrompts: string[] = [];
  const examplesToShow = useMemo(() => pickRandom(projectPrompts, 4), [projectPrompts]);

  const plan = useRenderPlan(messages);
  const lastMessageId = messages.length ? messages[messages.length - 1].id : undefined;

  const handleUseExample = useCallback((text: string) => onUseExample?.(text), [onUseExample]);

  if (plan.length === 0) {
    return (
      <Box w="100%">
        <EmptyState
          icon={<CassetteTapeIcon />}
          title="Welcome to the Kaset playground!"
          description="Kaset [ka'set] is an experimental open source toolkit to add coding agents directly into your webapp."
        >
          <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
            Why? Check out our{" "}
            <Link color="blue" href="https://kaset.dev">
              documentation
            </Link>
            .
          </Text>
          {hasCredentials() && (
            <VStack gap="sm" mt="sm" align="stretch">
              <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
                Try one of these example prompts to get see it in action:
              </Text>
              {examplesToShow.map((p) => (
                <Button key={p} variant="outline" size="sm" onClick={() => handleUseExample(p)}>
                  {p}
                </Button>
              ))}
            </VStack>
          )}
        </EmptyState>
      </Box>
    );
  }

  return (
    <>
      {plan.map((item) =>
        item.kind === "message" ? (
          <MessageRow
            key={item.key}
            message={item.message}
            isStreaming={Boolean(streaming && item.message.id === lastMessageId)}
            onOpenFile={onOpenFile}
          />
        ) : (
          <ToolGroupRow
            key={item.key}
            invocations={item.invocations}
            completed={item.completed}
            onOpenFile={onOpenFile}
          />
        ),
      )}
    </>
  );
}
