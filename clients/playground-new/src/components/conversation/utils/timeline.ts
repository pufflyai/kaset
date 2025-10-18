import type { TimelineDoc, TitleSegment } from "@/components/ui/timeline";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { buildDiffTitleSegments, buildFileDiffPreviews } from "./diff";
import { toolTypeToIconName } from "./toolIcon";
import { renderOpfsTool } from "./opfsTools";

const toJson = (value: any) => {
  try {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

function guessLanguageFromPath(filePath?: string): string | undefined {
  if (!filePath) return undefined;
  const name = filePath.toLowerCase();
  if (name.endsWith(".tsx") || name.endsWith(".ts")) return "typescript";
  if (name.endsWith(".jsx") || name.endsWith(".js")) return "javascript";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
  if (name.endsWith(".css")) return "css";
  if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
  if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
  return undefined;
}

export function invocationsToTimeline(invocations: ToolInvocation[], opts?: { labeledBlocks?: boolean }): TimelineDoc {
  const labeled = opts?.labeledBlocks ?? false;

  return {
    items: invocations.map((inv) => {
      const toolLabel = (inv.type || "tool").replace(/^tool-/, "");
      const isError = (inv as any).state === "output-error";

      const custom = renderOpfsTool(inv);
      if (custom) {
        return {
          id: inv.toolCallId,
          indicator: {
            type: "icon" as const,
            icon: toolTypeToIconName((inv as any).type),
            color: isError ? "foreground.feedback.alert" : undefined,
          },
          title: custom.title,
          blocks: custom.blocks,
          expandable: custom.expandable,
        };
      }

      const diffSegments = buildDiffTitleSegments(inv);
      const blocks: NonNullable<TimelineDoc["items"][number]["blocks"]> = [];

      const input = (inv as any).input;
      const output = (inv as any).output;
      const errorText = (inv as any).errorText as string | undefined;

      // If this invocation produced diff bubbles, prefer rendering diff editors
      if (diffSegments.length > 0) {
        const previews = buildFileDiffPreviews((input as any)?.diff);
        if (previews.length > 0) {
          for (const p of previews) {
            blocks.push({
              type: "diff",
              language: guessLanguageFromPath(p.filePath),
              original: p.original,
              modified: p.modified,
              sideBySide: false,
            });
          }
        }
      }

      // Fallback to regular input/output blocks when not rendering diffs
      if (blocks.length === 0) {
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
      }

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
