import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import type { TimelineDoc } from "../../components/timeline.tsx";
import {
  createDefaultToolRenderers,
  genericToolRenderer,
  getDefaultIndicatorForInvocation,
} from "./default-renderers.tsx";
import type { BuildToolTimelineOptions, ToolRenderer, ToolRendererResult, ToolRenderersMap } from "./types.ts";

const BASE_RENDERERS = createDefaultToolRenderers();

const mergeRenderers = (overrides?: ToolRenderersMap): ToolRenderersMap => {
  if (!overrides || Object.keys(overrides).length === 0) {
    return BASE_RENDERERS;
  }

  return { ...BASE_RENDERERS, ...overrides };
};

const pickRenderer = (renderers: ToolRenderersMap, type?: string): ToolRenderer | undefined => {
  if (!type) return undefined;
  return renderers[type];
};

export const buildTimelineDocFromInvocations = (
  invocations: ToolInvocation[],
  options?: BuildToolTimelineOptions,
): TimelineDoc => {
  const labeledBlocks = options?.labeledBlocks ?? false;
  const renderers = mergeRenderers(options?.toolRenderers);

  return {
    items: invocations.map((invocation) => {
      const type = typeof (invocation as any).type === "string" ? ((invocation as any).type as string) : undefined;
      const renderer = pickRenderer(renderers, type);
      const customResult = renderer?.(invocation, { labeledBlocks });
      const genericResult = genericToolRenderer(invocation, { labeledBlocks });
      const result: ToolRendererResult =
        customResult ??
        genericResult ??
        ({
          title: [
            {
              kind: "text",
              text: type ? type.replace(/^tool-/, "") : "Tool invocation",
              bold: true,
            },
          ],
        } satisfies ToolRendererResult);
      const indicator = result.indicator ?? getDefaultIndicatorForInvocation(invocation);

      return {
        id: invocation.toolCallId,
        indicator,
        title: result.title,
        blocks: result.blocks,
        expandable: result.expandable,
      };
    }),
  } satisfies TimelineDoc;
};
