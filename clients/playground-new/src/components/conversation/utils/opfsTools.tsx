import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import type { Block, TitleSegment } from "@/components/ui/timeline";
import { OpfsLsBlock, OpfsReadFileBlock, OpfsWriteFileBlock } from "../ConversationArea/OpfsToolBlocks";

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

export function renderOpfsTool(invocation: ToolInvocation): RenderResult | null {
  const type = ensureString((invocation as any).type);
  if (!type || (invocation as any).state !== "output-available") {
    return null;
  }

  switch (type) {
    case "tool-opfs_ls": {
      const input = (invocation as any).input as { path?: string } | undefined;
      const output = (invocation as any).output as { entries?: unknown } | undefined;
      const entries = toEntryArray(output?.entries);
      const pathLabel = ensureString(input?.path) || "/";

      return {
        title: [
          { kind: "text", text: "List" },
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
      const content = ensureStringOrEmpty(output?.llmContent);
      const language = guessLanguageFromPath(filePath);

      return {
        title: [
          { kind: "text", text: "Read file" },
          { kind: "link", text: fileName, filePath: filePath || undefined, href: undefined, variant: "bubble" },
        ],
        blocks: [
          {
            type: "component",
            render: () => (
              <OpfsReadFileBlock
                summary={ensureString(output?.returnDisplay)}
                content={content}
                language={language}
                truncated={Boolean(output?.isTruncated)}
              />
            ),
          },
        ],
        expandable: false,
      };
    }
    case "tool-opfs_write_file": {
      const input = (invocation as any).input as { file?: string; content?: string; diff?: string } | undefined;
      const output = (invocation as any).output as { previousContent?: unknown } | undefined;
      const filePath = ensureString(input?.file) || "";
      const language = guessLanguageFromPath(filePath);
      const originalContent = ensureStringOrEmpty(output?.previousContent);
      const newContent = ensureStringOrEmpty(input?.content);

      return {
        title: [
          { kind: "text", text: "Write file" },
          { kind: "link", text: filePath || "(unknown)", filePath, href: "" },
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
    default:
      return null;
  }
}
