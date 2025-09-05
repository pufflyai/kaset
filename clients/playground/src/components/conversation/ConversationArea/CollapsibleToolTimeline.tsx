import { TimelineFromJSON, type TimelineDoc } from "@/components/ui/timeline";
import type { ToolInvocation } from "@/types";
import { Box, HStack, Text } from "@chakra-ui/react";
import { ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import { invocationsToTimeline } from "../utils/timeline";

export function CollapsibleToolTimeline({
  invocations,
  onOpenFile,
  completed,
}: {
  invocations: ToolInvocation[];
  onOpenFile?: (filePath: string) => void;
  completed?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const toggle = () => setOpen((v) => !v);

  const data: TimelineDoc = invocationsToTimeline(invocations, { labeledBlocks: false });

  return (
    <Box width="full">
      <HStack
        onClick={toggle}
        align="center"
        justify="space-between"
        width="full"
        _hover={{ color: "foreground.primary" }}
        color="foreground.secondary"
      >
        <HStack className="group" gap="2" align="center" cursor="pointer">
          <Text textStyle="label/SM/regular">{completed ? "Done" : "Working..."}</Text>
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
        <Box mt="2">
          <TimelineFromJSON data={data} onOpenFile={onOpenFile} />
        </Box>
      ) : null}
    </Box>
  );
}
