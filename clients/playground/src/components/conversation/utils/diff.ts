import type { TitleSegment } from "@/components/ui/timeline";
import type { ToolInvocation } from "@/types";

export type FileChange = { filePath: string; additions: number; deletions: number };

export function basenameSafe(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

function normalizeHeaderPath(input?: string | null): string | null {
  if (!input) return null;

  const token = input.split("\t")[0].trim();
  if (token === "/dev/null") return null;

  if (token.startsWith("a/") || token.startsWith("b/")) {
    return token.slice(2);
  }
  return token;
}

export function parseUnifiedDiff(diffText?: string): FileChange[] {
  if (!diffText || typeof diffText !== "string") return [];

  const changes = new Map<string, { additions: number; deletions: number }>();
  let currentPath: string | null = null;
  let lastMinusHeader: string | null = null;

  const lines = diffText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith("--- ")) {
      lastMinusHeader = normalizeHeaderPath(line.slice(4));
      continue;
    }

    if (line.startsWith("+++ ")) {
      const plusPath = normalizeHeaderPath(line.slice(4));
      currentPath = plusPath ?? lastMinusHeader;
      if (currentPath && !changes.has(currentPath)) {
        changes.set(currentPath, { additions: 0, deletions: 0 });
      }
      continue;
    }

    if (!currentPath) continue;

    if (line.startsWith("@@")) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      const c = changes.get(currentPath);
      if (c) c.additions += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
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

export function buildDiffTitleSegments(inv: ToolInvocation): TitleSegment[] {
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

  return files.map((f) => ({
    kind: "diff",
    fileName: basenameSafe(f.filePath),
    filePath: f.filePath,
    additions: f.additions,
    deletions: f.deletions,
  }));
}
