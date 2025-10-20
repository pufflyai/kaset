import type { Block, TitleSegment } from "@/components/ui/timeline";
import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { buildDiffTitleSegments, buildFileDiffPreviews } from "./diff";
import { OpfsLsBlock, OpfsWriteFileBlock } from "../ConversationArea/OpfsToolBlocks";

interface RenderResult {
  title: TitleSegment[];
  blocks?: Block[];
  expandable?: boolean;
}

const guessLanguageFromPath = (filePath?: string): string | undefined => {
  if (!filePath) return undefined;
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  return undefined;
};

const toEntryArray = (value: unknown): Array<{ path: string; kind: "file" | "directory" }> => {
  if (!Array.isArray(value)) return [];
  const entries: Array<{ path: string; kind: "file" | "directory" }> = [];
  for (const item of value) {
    if (typeof item === "string") {
      const isDir = item.endsWith("/");
      entries.push({ path: isDir ? item.slice(0, -1) : item, kind: isDir ? "directory" : "file" });
      continue;
    }
    if (item && typeof item === "object" && typeof (item as any).path === "string") {
      const kind = (item as any).kind === "directory" ? "directory" : "file";
      entries.push({ path: (item as any).path, kind });
    }
  }
  return entries;
};

const ensureString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const ensureStringOrEmpty = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const extractFileName = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || filePath;
};

const isPendingState = (state: string) => state === "input-streaming" || state === "input-available";

const toJson = (value: unknown): string => {
  try {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

export function renderOpfsTool(invocation: ToolInvocation): RenderResult | null {
  const type = ensureString((invocation as any).type);
  const state = ensureString((invocation as any).state);
  if (!type || !state) {
    return null;
  }

  const errorText = ensureString((invocation as any).errorText);

  switch (type) {
    case "tool-opfs_ls": {
      const input = (invocation as any).input as { path?: string } | undefined;
      const output = (invocation as any).output as { entries?: unknown } | undefined;
      const entries = toEntryArray(output?.entries);
      const pathLabel = ensureString(input?.path) || "/";

      if (isPendingState(state)) {
        return {
          title: [
            { kind: "text", text: "Listing directory" },
            { kind: "text", text: pathLabel, bold: true },
          ],
          expandable: false,
        };
      }

      if (state === "output-error") {
        return {
          title: [
            { kind: "text", text: "Failed to list" },
            { kind: "text", text: pathLabel, bold: true },
          ],
          blocks: errorText
            ? [
                {
                  type: "text",
                  text: errorText,
                },
              ]
            : undefined,
          expandable: false,
        };
      }

      if (state !== "output-available") {
        return null;
      }

      return {
        title: [
          { kind: "text", text: "Explored files in" },
          { kind: "text", text: pathLabel, bold: true },
        ],
        blocks: [
          {
            type: "component",
            render: ({ onOpenFile }) => <OpfsLsBlock entries={entries} onOpenFile={onOpenFile} />,
          },
        ],
      };
    }
    case "tool-opfs_read_file": {
      if (isPendingState(state)) {
        const input = (invocation as any).input as { file?: string } | undefined;
        const filePath = ensureString(input?.file) || "";
        const fileName = filePath ? extractFileName(filePath) : "(unknown)";

        return {
          title: [
            { kind: "text", text: "Reading file" },
            { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
          ],
          expandable: false,
        };
      }
      if (state === "output-error") {
        const input = (invocation as any).input as { file?: string } | undefined;
        const filePath = ensureString(input?.file) || "";
        const fileName = filePath ? extractFileName(filePath) : "(unknown)";

        return {
          title: [
            { kind: "text", text: "Failed to read file" },
            { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
          ],
          blocks: errorText
            ? [
                {
                  type: "text",
                  text: errorText,
                },
              ]
            : undefined,
          expandable: false,
        };
      }
      if (state !== "output-available") {
        return null;
      }
      const input = (invocation as any).input as { file?: string } | undefined;
      const output = (invocation as any).output as
        | {
            file?: string;
            llmContent?: unknown;
            returnDisplay?: string;
            isTruncated?: boolean;
          }
        | undefined;
      const filePath = ensureString(input?.file) || ensureString(output?.file) || "";
      const fileName = filePath ? extractFileName(filePath) : "(unknown)";

      return {
        title: [
          { kind: "text", text: "Read file" },
          { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
        ],
        blocks: [
          {
            type: "component",
            render: () => null,
          },
        ],
        expandable: false,
      };
    }
    case "tool-opfs_write_file": {
      const input = (invocation as any).input as { file?: string; content?: string; diff?: string } | undefined;
      const filePath = ensureString(input?.file) || "";
      const fileName = filePath ? extractFileName(filePath) : "(unknown)";
      const language = guessLanguageFromPath(filePath);

      if (isPendingState(state)) {
        return {
          title: [
            { kind: "text", text: "Writing file" },
            { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
          ],
          expandable: false,
        };
      }

      if (state === "output-error") {
        return {
          title: [
            { kind: "text", text: "Failed to write file" },
            { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
          ],
          blocks: errorText
            ? [
                {
                  type: "text",
                  text: errorText,
                },
              ]
            : undefined,
          expandable: false,
        };
      }

      if (state !== "output-available") {
        return null;
      }
      const output = (invocation as any).output as { previousContent?: unknown } | undefined;
      const originalContent = ensureStringOrEmpty(output?.previousContent);
      const newContent = ensureStringOrEmpty(input?.content);

      return {
        title: [
          { kind: "text", text: "Wrote file" },
          { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
        ],
        blocks: [
          {
            type: "component",
            render: () => (
              <OpfsWriteFileBlock originalContent={originalContent} newContent={newContent} language={language} />
            ),
          },
        ],
      };
    }
    case "tool-opfs_patch": {
      const isError = state === "output-error";
      const input = (invocation as any).input;
      const output = (invocation as any).output;

      const diffSegments = buildDiffTitleSegments(invocation);
      const diffText = ensureString((input as any)?.diff);
      const previews = buildFileDiffPreviews(diffText);

      const blocks: Block[] = [];
      for (const preview of previews) {
        blocks.push({
          type: "diff",
          language: guessLanguageFromPath(preview.filePath),
          original: preview.original,
          modified: preview.modified,
          sideBySide: false,
        });
      }

      if (blocks.length === 0) {
        if (input != null) {
          blocks.push({ type: "code", language: "json", code: toJson(input), editable: false });
        }

        if (isError && errorText) {
          blocks.push({ type: "code", language: "text", code: errorText, editable: false });
        } else if (!isError && output != null) {
          blocks.push({ type: "code", language: "json", code: toJson(output), editable: false });
        }
      }

      const title: TitleSegment[] =
        diffSegments.length > 0
          ? diffSegments
          : [
              {
                kind: "text",
                text: isError ? "Failed to apply patch" : isPendingState(state) ? "Applying patch" : "Applied patch",
                bold: true,
              },
            ];

      return {
        title,
        blocks: blocks.length > 0 ? blocks : undefined,
      };
    }
    default:
      return null;
  }
}
