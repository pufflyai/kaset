import { ResourceBadge } from "./resource-badge";
import { Response } from "./ai-response";
import { Box, Text } from "@chakra-ui/react";
import type { ToolInvocation, UIMessage } from "../adapters/kas";
import type { ReactNode } from "react";
import { ToolInvocationTimeline } from "./tool-invocation-timeline";

export interface MessagePartsProps {
  message: UIMessage;
  streaming?: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function MessagePartsRenderer(props: MessagePartsProps) {
  const { message, onOpenFile } = props;
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
        <Text key={key} textStyle="label/S/regular" color="foreground.secondary" pt="sm" pb="0">
          {part.text}
        </Text>,
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
          <ToolInvocationTimeline invocations={invocations} labeledBlocks onOpenFile={onOpenFile} />
        </Box>,
      );
      continue;
    }

    nodes.push(null);
  }

  return <>{nodes}</>;
}
