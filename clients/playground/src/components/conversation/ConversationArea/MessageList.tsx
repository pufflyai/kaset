import { MessageContent, MessageRoot } from "@/components/ui/ai-message";
import { EmptyState } from "@/components/ui/empty-state";
import { examplePrompts as slidesPrompts } from "@/examples/slides/example-prompts";
import { examplePrompts as todoPrompts } from "@/examples/todo/example-prompts";
import { useWorkspaceStore } from "@/state/WorkspaceProvider";
import type { Message, ToolInvocation } from "@/types";
import { Box, Button, Link, Text, VStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { CollapsibleToolTimeline } from "./CollapsibleToolTimeline";
import { MessagePartsRenderer } from "./MessagePartsRenderer";

export function MessageList({
  messages,
  streaming,
  onOpenFile,
  onUseExample,
}: {
  messages: Message[];
  streaming: boolean;
  onOpenFile?: (filePath: string) => void;
  onUseExample?: (text: string) => void;
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
    const selectedProject = useWorkspaceStore((s) => s.selectedProjectId || "todo");

    const byProject: Record<string, string[]> = {
      todo: todoPrompts,
      slides: slidesPrompts,
    };

    const projectPrompts = byProject[selectedProject] ?? todoPrompts;

    const examplesToShow = useMemo(() => {
      const shuffled = [...projectPrompts].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, 4);
    }, [messages.length, selectedProject]);

    out.push(
      <Box key="empty" w="full">
        <EmptyState
          title="Welcome to the Kaset playground!"
          description="Kaset [ka'set] is an experimental open source toolkit to add coding agents directly into your webapp."
        >
          <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
            Why? Checkout our{" "}
            <Link color="blue" href="https://pufflyai.github.io/kaset/">
              documentation
            </Link>
            .
          </Text>
          <VStack gap="sm" mt="sm" align="stretch">
            <Text textAlign="center" textStyle="label/S/regular" color="fg.muted">
              Try one of these example prompts to get see it in action:
            </Text>
            {examplesToShow.map((p) => (
              <Button key={p} variant="outline" size="sm" onClick={() => onUseExample?.(p)}>
                {p}
              </Button>
            ))}
          </VStack>
        </EmptyState>
      </Box>,
    );
  }

  return <>{out}</>;
}
