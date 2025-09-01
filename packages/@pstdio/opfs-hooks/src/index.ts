import { getDirectoryHandle, ls, readFile } from "@pstdio/opfs-utils";
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

    load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { content };
};

export const useFolder = (path = "") => {
  const [rootNode, setRootNode] = useState<FileNode | null>(null);

  useEffect(() => {
    let cancelled = false;

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

    load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { rootNode };
};
