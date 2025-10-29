import { useMemo } from "react";
import { ToolInvocation } from "../adapters/kas";
import { useToolTimelineBuilder } from "../state";
import { TimelineFromJSON } from "./timeline";

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
