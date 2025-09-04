import { getDirectoryHandle, ls, readFile, watchDirectory, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";
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

export const useFileContent = (path?: string) => {
  const [content, setContent] = useState("");

  useEffect(() => {
    let cancelled = false;
    let stopWatch: DirectoryWatcherCleanup | null = null;

    async function load() {
      if (!path) {
        setContent("");
        return;
      }

      try {
        const text = await readFile(path);
        if (!cancelled) setContent(text);
      } catch {
        if (!cancelled) setContent("");
      }
    }

    async function watch() {
      if (!path) return;

      try {
        const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        const parts = normalized.split("/").filter(Boolean);
        const dirParts = parts.slice(0, -1);
        const relTarget = parts.slice(dirParts.length).join("/");

        const dirPath = dirParts.join("/");
        const dir = await getDirectoryHandle(dirPath);

        stopWatch = await watchDirectory(dir, (changes) => {
          for (const ch of changes) {
            const rel = ch.path.join("/");
            if (rel === relTarget) {
              load();
              break;
            }
          }
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

  return { content };
};

export const useFolder = (path = "") => {
  const [rootNode, setRootNode] = useState<FileNode | null>(null);

  useEffect(() => {
    let cancelled = false;
    let stopWatch: DirectoryWatcherCleanup | null = null;

    async function load() {
      try {
        const dir = await getDirectoryHandle(path);
        const entries = await ls(dir, { maxDepth: Infinity });
        const tree = buildTree(entries, path);

        if (!cancelled) setRootNode(tree);
      } catch {
        if (!cancelled) setRootNode(null);
      }
    }

    async function watch() {
      try {
        const dir = await getDirectoryHandle(path);
        stopWatch = await watchDirectory(dir, () => {
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
