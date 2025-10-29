import { useMemo } from "react";
import { TimelineFromJSON } from "../timeline.tsx";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { useToolTimelineBuilder } from "../../state";

export interface ToolInvocationTimelineProps {
  invocations: ToolInvocation[];
  labeledBlocks?: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function ToolInvocationTimeline(props: ToolInvocationTimelineProps) {
  const { invocations, labeledBlocks = true, onOpenFile } = props;
  const buildTimeline = useToolTimelineBuilder();

  const data = useMemo(() => {
    return buildTimeline(invocations, { labeledBlocks });
  }, [buildTimeline, invocations, labeledBlocks]);

  return <TimelineFromJSON data={data} onOpenFile={onOpenFile} />;
}
