import { TimelineFromJSON, type TimelineDoc } from "../../primitives/timeline";
import { Box, HStack, Text } from "@chakra-ui/react";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { ChevronUpIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { invocationsToTimeline } from "../../../utils/timeline";

export function CollapsibleToolTimeline({
  invocations,
  onOpenFile,
  completed,
}: {
  invocations: ToolInvocation[];
  onOpenFile?: (filePath: string) => void;
  completed?: boolean;
}) {
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
  const toggle = () => setOpen((v) => !v);

  const data: TimelineDoc | null = useMemo(() => {
    if (!open) return null;
    return invocationsToTimeline(invocations, { labeledBlocks: false });
  }, [open, invocations]);

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
      {open && data ? (
        <Box mt="sm">
          <TimelineFromJSON data={data} onOpenFile={onOpenFile} />
        </Box>
      ) : null}
    </Box>
  );
}
