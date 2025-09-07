import type { TimelineDoc, TitleSegment } from "@/components/ui/timeline";
import type { ToolInvocation } from "@/types";
import { buildDiffTitleSegments } from "./diff";
import { toolTypeToIconName } from "./toolIcon";

const toJson = (value: any) => {
  try {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export function invocationsToTimeline(invocations: ToolInvocation[], opts?: { labeledBlocks?: boolean }): TimelineDoc {
  const labeled = opts?.labeledBlocks ?? false;

  return {
    items: invocations.map((inv) => {
      const toolLabel = (inv.type || "tool").replace(/^tool-/, "");
      const isError = (inv as any).state === "output-error";

      const blocks: NonNullable<TimelineDoc["items"][number]["blocks"]> = [];
      const input = (inv as any).input;
      const output = (inv as any).output;
      const errorText = (inv as any).errorText as string | undefined;

      if (input != null) {
        if (labeled) blocks.push({ type: "text", text: "Input" });
        blocks.push({ type: "code", language: "json", code: toJson(input), editable: false });
      }

      if (isError && errorText) {
        if (labeled) blocks.push({ type: "text", text: "Error" });
        blocks.push({ type: "code", language: "text", code: errorText, editable: false });
      }

      if (!isError && output != null) {
        if (labeled) blocks.push({ type: "text", text: "Output" });
        blocks.push({ type: "code", language: "json", code: toJson(output), editable: false });
      }

      const diffSegments = buildDiffTitleSegments(inv);

      return {
        id: inv.toolCallId,
        indicator: {
          type: "icon" as const,
          icon: toolTypeToIconName((inv as any).type),
          color: isError ? "foreground.feedback.alert" : undefined,
        },
        title:
          diffSegments.length > 0 ? diffSegments : ([{ kind: "text", text: toolLabel, bold: true }] as TitleSegment[]),
        blocks: blocks.length > 0 ? blocks : undefined,
      };
    }),
  };
}
