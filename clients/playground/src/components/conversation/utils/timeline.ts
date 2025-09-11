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

type FileDiffPreview = { filePath: string; original: string; modified: string };

function buildFileDiffPreviews(diffText?: string): FileDiffPreview[] {
  if (!diffText || typeof diffText !== "string") return [];

  const lines = diffText.split(/\r?\n/);
  const previews: FileDiffPreview[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] || "";
    if (line.startsWith("--- ")) {
      const oldHeader = line.slice(4).split("\t")[0].trim();
      const next = lines[i + 1] || "";
      if (!next.startsWith("+++ ")) {
        i += 1;
        continue;
      }
      const newHeader = next.slice(4).split("\t")[0].trim();

      // Normalize a/ b/ prefixes and /dev/null
      const norm = (p: string) =>
        p === "/dev/null"
          ? null
          : p
              .replace(/^([ab]\/)*/, "")
              .replace(/^\/+/, "")
              .replace(/\\/g, "/");

      const oldPath = norm(oldHeader);
      const newPath = norm(newHeader);
      const filePath = newPath ?? oldPath ?? "";
      i += 2;

      const orig: string[] = [];
      const mod: string[] = [];

      while (i < lines.length) {
        const l = lines[i] || "";
        if (l.startsWith("--- ") || l.startsWith("diff --git ")) break;
        if (l.startsWith("@@")) {
          // Start of a hunk: we simply accumulate hunk body lines below
          i += 1;
          while (i < lines.length) {
            const body = lines[i] || "";
            if (
              body.startsWith("--- ") ||
              body.startsWith("@@") ||
              body.startsWith("diff --git ") ||
              (!body.startsWith(" ") && !body.startsWith("+") && !body.startsWith("-") && body.trim() !== "")
            ) {
              break;
            }

            if (body.startsWith(" ")) {
              const t = body.slice(1);
              orig.push(t);
              mod.push(t);
            } else if (body.startsWith("-")) {
              orig.push(body.slice(1));
            } else if (body.startsWith("+")) {
              mod.push(body.slice(1));
            }

            i += 1;
          }
          // Add blank line separator between hunks for readability
          if (orig.length > 0 || mod.length > 0) {
            orig.push("");
            mod.push("");
          }
          continue;
        }

        // Skip non-hunk lines until next file or hunk
        i += 1;
      }

      previews.push({ filePath, original: orig.join("\n"), modified: mod.join("\n") });
      continue;
    }
    i += 1;
  }

  return previews;
}

export function invocationsToTimeline(invocations: ToolInvocation[], opts?: { labeledBlocks?: boolean }): TimelineDoc {
  const labeled = opts?.labeledBlocks ?? false;

  return {
    items: invocations.map((inv) => {
      const toolLabel = (inv.type || "tool").replace(/^tool-/, "");
      const isError = (inv as any).state === "output-error";

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
