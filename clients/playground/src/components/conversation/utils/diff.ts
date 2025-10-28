import type { TitleSegment } from "@pstdio/kas-ui";
import type { ToolInvocation, UIMessage } from "@pstdio/kas/kas-ui";

export type FileChange = { filePath: string; additions: number; deletions: number };

export function basenameSafe(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function normalizeHeaderPath(input?: string | null): string | null {
  if (!input) return null;

  const token = input.split("\t")[0].trim();
  if (token === "/dev/null") return null;

  let normalized = token;
  if (normalized.startsWith("a/") || normalized.startsWith("b/")) {
    normalized = normalized.slice(2);
  }

  normalized = normalized.replace(/^\/+/, "").replace(/\\/g, "/");
  return normalized;
}

export function parseUnifiedDiff(diffText?: string): FileChange[] {
  if (!diffText || typeof diffText !== "string") return [];

  const changes = new Map<string, { additions: number; deletions: number }>();
  let currentPath: string | null = null;
  let lastMinusHeader: string | null = null;
  let inHunk = false;

  const lines = diffText.split(/\r?\n/);
  for (const line of lines) {
    // File headers
    if (line.startsWith("--- ")) {
      lastMinusHeader = normalizeHeaderPath(line.slice(4));
      inHunk = false;
      continue;
    }

    if (line.startsWith("+++ ")) {
      const plusPath = normalizeHeaderPath(line.slice(4));
      currentPath = plusPath ?? lastMinusHeader;
      if (currentPath && !changes.has(currentPath)) {
        changes.set(currentPath, { additions: 0, deletions: 0 });
      }
      inHunk = false;
      continue;
    }

    if (!currentPath) continue;

    // Hunk header
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }

    if (!inHunk) continue;

    // Added/removed lines inside a hunk. Exclude file headers strictly ("+++ ", "--- ").
    if (line.startsWith("+") && !(line.startsWith("+++ ") || line === "+++")) {
      const c = changes.get(currentPath);
      if (c) c.additions += 1;
      continue;
    }

    if (line.startsWith("-") && !(line.startsWith("--- ") || line === "---")) {
      const c = changes.get(currentPath);
      if (c) c.deletions += 1;
      continue;
    }
  }

  return Array.from(changes.entries()).map(([filePath, { additions, deletions }]) => ({
    filePath,
    additions,
    deletions,
  }));
}

export function extractFileChanges(inv: ToolInvocation): FileChange[] {
  if (!inv || (inv as any).type !== "tool-opfs_patch") return [];

  const input = (inv as any).input as { diff?: string } | undefined;
  const output = (inv as any).output as
    | {
        details?: {
          created?: string[];
          modified?: string[];
          deleted?: string[];
          renamed?: Array<{ from: string; to: string }>;
        };
      }
    | undefined;

  const parsed = parseUnifiedDiff(input?.diff);
  let files: FileChange[] = parsed;

  if (files.length === 0 && output?.details) {
    const details = output.details;
    const paths = new Set<string>();
    for (const p of details.created ?? []) paths.add(p);
    for (const p of details.modified ?? []) paths.add(p);
    for (const p of details.deleted ?? []) paths.add(p);
    for (const rn of details.renamed ?? []) paths.add(rn?.to || rn?.from);

    files = Array.from(paths).map((p) => ({ filePath: p, additions: 0, deletions: 0 }));
  }

  return files;
}

export function buildDiffTitleSegments(inv: ToolInvocation): TitleSegment[] {
  const files = extractFileChanges(inv);
  if (files.length === 0) return [];

  return files.map((f) => ({
    kind: "diff",
    fileName: basenameSafe(f.filePath),
    filePath: f.filePath,
    additions: f.additions,
    deletions: f.deletions,
  }));
}

export type FileDiffPreview = { filePath: string; original: string; modified: string };

export function buildFileDiffPreviews(diffText?: string): FileDiffPreview[] {
  if (!diffText || typeof diffText !== "string") return [];

  const lines = diffText.split(/\r?\n/);
  const previews: FileDiffPreview[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] || "";
    if (!line.startsWith("--- ")) {
      i += 1;
      continue;
    }

    const oldHeader = normalizeHeaderPath(line.slice(4));
    const next = lines[i + 1] || "";
    if (!next.startsWith("+++ ")) {
      i += 1;
      continue;
    }

    const newHeader = normalizeHeaderPath(next.slice(4));
    const filePath = newHeader ?? oldHeader ?? "";
    i += 2;

    const original: string[] = [];
    const modified: string[] = [];

    while (i < lines.length) {
      const current = lines[i] || "";
      if (current.startsWith("--- ") || current.startsWith("diff --git ")) break;

      if (current.startsWith("@@")) {
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
            const text = body.slice(1);
            original.push(text);
            modified.push(text);
          } else if (body.startsWith("-")) {
            original.push(body.slice(1));
          } else if (body.startsWith("+")) {
            modified.push(body.slice(1));
          }

          i += 1;
        }

        if (original.length > 0 || modified.length > 0) {
          original.push("");
          modified.push("");
        }

        continue;
      }

      i += 1;
    }

    previews.push({ filePath, original: original.join("\n"), modified: modified.join("\n") });
  }

  return previews;
}

export function summarizeConversationChanges(messages: UIMessage[]): {
  additions: number;
  deletions: number;
  fileCount: number;
} {
  const totals = new Map<string, { additions: number; deletions: number }>();

  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type !== "tool-invocation") continue;

      const files = extractFileChanges(part.toolInvocation);
      for (const file of files) {
        const existing = totals.get(file.filePath);
        const additions = Math.max(0, file.additions);
        const deletions = Math.max(0, file.deletions);

        if (existing) {
          existing.additions += additions;
          existing.deletions += deletions;
          continue;
        }

        totals.set(file.filePath, { additions, deletions });
      }
    }
  }

  let totalAdditions = 0;
  let totalDeletions = 0;

  for (const item of totals.values()) {
    totalAdditions += item.additions;
    totalDeletions += item.deletions;
  }

  return {
    additions: totalAdditions,
    deletions: totalDeletions,
    fileCount: totals.size,
  };
}
