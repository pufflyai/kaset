import { ReasoningContent, ReasoningRoot, ReasoningTrigger } from "@/components/ui/ai-reasoning";
import { Response } from "@/components/ui/ai-response";
import { ResourceBadge } from "@/components/ui/resource-badge";
import { TimelineFromJSON } from "@/components/ui/timeline";
import type { Message, ToolInvocation } from "@/types";
import { Box } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { invocationsToTimeline } from "../utils/timeline";

interface MessagePartsProps {
  message: Message;
  streaming?: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function MessagePartsRenderer(props: MessagePartsProps) {
  const { message, streaming, onOpenFile } = props;
  const nodes: ReactNode[] = [];

  for (let partIndex = 0; partIndex < message.parts.length; partIndex++) {
    const part = message.parts[partIndex] as any;
    const key = `${message.id}-${partIndex}`;

    if (part.type === "text") {
      nodes.push(
        <div key={key}>
          <Response>{part.text}</Response>
        </div>,
      );
      continue;
    }

    if (part.type === "reasoning") {
      nodes.push(
        <ReasoningRoot width="full" streaming={streaming} key={key}>
          <ReasoningTrigger />
          <ReasoningContent pt="0">{part.text}</ReasoningContent>
        </ReasoningRoot>,
      );
      continue;
    }

    if (part.type === "file") {
      nodes.push(
        <Box key={key} width="fit-content">
          <ResourceBadge
            fileName={part.filename ?? part.url}
            onSelect={() => onOpenFile?.(part.filename ?? part.url)}
          />
        </Box>,
      );
      continue;
    }

    if (part.type === "tool-invocation") {
      const invocations: ToolInvocation[] = [part.toolInvocation];
      let lookahead = partIndex + 1;
      while (lookahead < message.parts.length && (message.parts[lookahead] as any).type === "tool-invocation") {
        invocations.push((message.parts[lookahead] as any).toolInvocation as ToolInvocation);
        lookahead += 1;
      }
      partIndex = lookahead - 1;

      nodes.push(
        <Box key={key} width="full">
          <TimelineFromJSON
            data={invocationsToTimeline(invocations, { labeledBlocks: true })}
            onOpenFile={onOpenFile}
          />
        </Box>,
      );
      continue;
    }

    nodes.push(null);
  }

  return <>{nodes}</>;
}
