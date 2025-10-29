import { Box, HStack, Text } from "@chakra-ui/react";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { ChevronUpIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ToolInvocationTimeline } from "./tool-invocation-timeline.tsx";

export interface CollapsibleToolTimelineProps {
  invocations: ToolInvocation[];
  onOpenFile?: (filePath: string) => void;
  completed?: boolean;
}

export function CollapsibleToolTimeline(props: CollapsibleToolTimelineProps) {
  const { completed, invocations, onOpenFile } = props;
  const [open, setOpen] = useState<boolean>(() => !completed);
  const previousCompletedRef = useRef(completed);

  useEffect(() => {
    if (completed && !previousCompletedRef.current) {
      setOpen(false);
    } else if (!completed && previousCompletedRef.current) {
      setOpen(true);
    }

    previousCompletedRef.current = completed;
  }, [completed]);
  const toggle = () => setOpen((value) => !value);

  return (
    <Box width="full" maxW="820px" mx="auto">
      <HStack
        onClick={toggle}
        align="center"
        justify="space-between"
        width="full"
        _hover={{ color: "foreground.primary" }}
        color="foreground.secondary"
      >
        <HStack className="group" gap="xs" align="center" cursor="pointer">
          <Text textStyle="label/SM/regular">{completed ? "Finished working" : "Working..."}</Text>
          <Box
            transition="transform 200ms ease, color 200ms ease"
            color="transparent"
            _groupHover={{ color: "foreground.primary" }}
          >
            <ChevronUpIcon
              size={14}
              style={{
                transition: "transform 200ms ease, color 200ms ease",
                transform: open ? "rotate(0deg)" : "rotate(-180deg)",
              }}
            />
          </Box>
        </HStack>
      </HStack>
      {open ? (
        <Box mt="sm">
          <ToolInvocationTimeline invocations={invocations} labeledBlocks={false} onOpenFile={onOpenFile} />
        </Box>
      ) : null}
    </Box>
  );
}
