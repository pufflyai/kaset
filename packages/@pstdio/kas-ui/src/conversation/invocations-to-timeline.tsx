import type { TimelineDoc, TitleSegment } from "../components/timeline.tsx";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { buildDiffTitleSegments, buildFileDiffPreviews } from "./diff.ts";
import { renderOpfsTool } from "./opfs-tools.tsx";
import { toolTypeToIconName } from "./tool-icon.ts";

const toJson = (value: unknown): string => {
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

export function invocationsToTimeline(
  invocations: ToolInvocation[],
  options?: { labeledBlocks?: boolean },
): TimelineDoc {
  const labeled = options?.labeledBlocks ?? false;

  return {
    items: invocations.map((invocation) => {
      const toolLabel = (invocation.type || "tool").replace(/^tool-/, "");
      const isError = (invocation as any).state === "output-error";

      const custom = renderOpfsTool(invocation);
      if (custom) {
        return {
          id: invocation.toolCallId,
          indicator: {
            type: "icon" as const,
            icon: toolTypeToIconName((invocation as any).type),
            color: isError ? "foreground.feedback.alert" : undefined,
          },
          title: custom.title,
          blocks: custom.blocks,
          expandable: custom.expandable,
        };
      }

      const diffSegments = buildDiffTitleSegments(invocation);
      const blocks: NonNullable<TimelineDoc["items"][number]["blocks"]> = [];

      const input = (invocation as any).input;
      const output = (invocation as any).output;
      const errorText = (invocation as any).errorText as string | undefined;

      if (diffSegments.length > 0) {
        const previews = buildFileDiffPreviews((input as any)?.diff);
        if (previews.length > 0) {
          for (const preview of previews) {
            blocks.push({
              type: "diff",
              language: guessLanguageFromPath(preview.filePath),
              original: preview.original,
              modified: preview.modified,
              sideBySide: false,
            });
          }
        }
      }

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
        id: invocation.toolCallId,
        indicator: {
          type: "icon" as const,
          icon: toolTypeToIconName((invocation as any).type),
          color: isError ? "foreground.feedback.alert" : undefined,
        },
        title:
          diffSegments.length > 0 ? diffSegments : ([{ kind: "text", text: toolLabel, bold: true }] as TitleSegment[]),
        blocks: blocks.length > 0 ? blocks : undefined,
      };
    }),
  };
}
