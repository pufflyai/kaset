import { ls, watchDirectory, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";
import { useEffect, useState } from "react";

export type FileNode = {
  id: string;
  name: string;
  children?: FileNode[];
};

function buildTree(entries: Awaited<ReturnType<typeof ls>>, base: string): FileNode {
  const rootName = base.split("/").filter(Boolean).pop() ?? "";
  const root: FileNode = { id: base, name: rootName, children: [] };

  const prefix = base ? base.replace(/\/+$/, "") + "/" : "";

  for (const e of entries) {
    const parts = e.path.split("/").filter(Boolean);
    let cur = root;

    parts.forEach((part, idx) => {
      const id = prefix + parts.slice(0, idx + 1).join("/");
      cur.children ??= [];

      let child = cur.children.find((c) => c.name === part);
      if (!child) {
        child = { id, name: part };
        cur.children.push(child);
      }

      cur = child;
    });
  }

  return root;
}

export const useFolder = (path = "") => {
  const [rootNode, setRootNode] = useState<FileNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stopWatch: DirectoryWatcherCleanup | null = null;

    async function load() {
      try {
        const entries = await ls(path, { maxDepth: Infinity });
        const tree = buildTree(entries, path);

        if (!cancelled) setRootNode(tree);
      } catch {
        if (!cancelled) setRootNode(null);
      }
    }

    async function watch() {
      try {
        stopWatch = await watchDirectory(path, () => {
          load();
        });
      } catch {
        stopWatch?.();
        stopWatch = null;
      }
    }

    load();
    watch();

    return () => {
      cancelled = true;
      stopWatch?.();
    };
  }, [path]);

  return { rootNode };
};
