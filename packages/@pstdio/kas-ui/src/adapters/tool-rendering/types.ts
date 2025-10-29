import type { Block, Indicator, TimelineDoc, TitleSegment } from "../../components/timeline";
import type { ToolInvocation } from "../kas";

export interface ToolRendererOptions {
  labeledBlocks: boolean;
}

export interface ToolRendererResult {
  title: TitleSegment[];
  blocks?: Block[];
  expandable?: boolean;
  indicator?: Indicator;
}

export type ToolRenderer = (invocation: ToolInvocation, options: ToolRendererOptions) => ToolRendererResult | null;

export type ToolRenderersMap = Record<string, ToolRenderer>;

export interface BuildToolTimelineOptions {
  labeledBlocks?: boolean;
  toolRenderers?: ToolRenderersMap;
}

export interface ToolTimelineBuilder {
  (invocations: ToolInvocation[], options?: BuildToolTimelineOptions): TimelineDoc;
}
