import { useEffect, useMemo, useState } from "react";
import type { FsScope } from "@pstdio/tiny-plugins";
import type { LsEntry } from "@pstdio/opfs-utils";
import type { TinyUiHost } from "../host";

export interface FsNode {
  id: string;
  name: string;
  children?: FsNode[];
}

const textDecoder = new TextDecoder();

const normalizePath = (path: string | null | undefined) => {
  if (!path) return "";
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");
};

const joinPaths = (base: string, relative: string) => {
  const normalizedBase = normalizePath(base);
  const normalizedRelative = normalizePath(relative);
  if (!normalizedBase) return normalizedRelative;
  if (!normalizedRelative) return normalizedBase;
  return `${normalizedBase}/${normalizedRelative}`;
};

const deriveNameFromPath = (path: string) => {
  const normalized = normalizePath(path);
  if (!normalized) return "/";
  const segments = normalized.split("/");
  return segments[segments.length - 1] || "/";
};

const createRootNode = (absoluteId: string, label: string): FsNode => ({
  id: absoluteId || "/",
  name: label || "/",
  children: [],
});

const sortTree = (node: FsNode) => {
  if (!Array.isArray(node.children)) return;

  node.children.sort((a, b) => {
    const aIsDir = Array.isArray(a.children);
    const bIsDir = Array.isArray(b.children);
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  for (const child of node.children) {
    if (Array.isArray(child.children)) sortTree(child);
  }
};

const buildTree = (entries: LsEntry[], rootId: string, rootName: string): FsNode => {
  const root = createRootNode(rootId, rootName);
  const nodeMap = new Map<string, FsNode>();
  nodeMap.set("", root);

  const ensureDirectory = (relative: string) => {
    const normalized = normalizePath(relative);
    if (!normalized) return root;

    const segments = normalized.split("/");
    let parentKey = "";
    let parentNode = root;

    for (const segment of segments) {
      const currentKey = parentKey ? `${parentKey}/${segment}` : segment;
      let node = nodeMap.get(currentKey);

      if (!node) {
        node = { id: joinPaths(rootId, currentKey), name: segment, children: [] };
        nodeMap.set(currentKey, node);
        parentNode.children = parentNode.children ?? [];
        parentNode.children.push(node);
      }

      if (!Array.isArray(node.children)) {
        node.children = [];
      }

      parentNode = node;
      parentKey = currentKey;
    }

    return parentNode;
  };

  for (const entry of entries) {
    const relativePath = normalizePath(entry.path);

    if (entry.kind === "directory") {
      ensureDirectory(relativePath);
      continue;
    }

    if (!relativePath) continue;

    const segments = relativePath.split("/");
    const fileName = segments.pop() ?? relativePath;
    const parentRelative = segments.join("/");
    const parentNode = ensureDirectory(parentRelative);
    const absoluteId = joinPaths(rootId, relativePath);

    parentNode.children = parentNode.children ?? [];
    if (!parentNode.children.some((child) => child.id === absoluteId)) {
      parentNode.children.push({ id: absoluteId, name: fileName });
    }
  }

  sortTree(root);
  return root;
};

export function useFsTree(host: TinyUiHost, rootDir: string, scope: FsScope) {
  const normalizedRoot = useMemo(() => normalizePath(rootDir), [rootDir]);
  const fallbackRoot = useMemo(() => {
    const id = normalizedRoot || "/";
    const name = deriveNameFromPath(normalizedRoot);
    return createRootNode(id, name);
  }, [normalizedRoot]);

  const [tree, setTree] = useState<FsNode>(fallbackRoot);

  useEffect(() => {
    let cancelled = false;
    setTree(fallbackRoot);

    const loadTree = async () => {
      let scopeRoot = "";
      try {
        scopeRoot = await host.call<string>("fs.getScopeRoot", { scope });
        const absoluteRoot = joinPaths(scopeRoot, normalizedRoot);
        const rootName = deriveNameFromPath(normalizedRoot || scopeRoot);
        const entries = await host.call<LsEntry[]>("fs.ls", {
          ...(normalizedRoot ? { path: normalizedRoot } : {}),
          scope,
          options: { maxDepth: Infinity },
        });

        if (cancelled) return;
        const nextTree = buildTree(entries, absoluteRoot || "/", rootName);
        setTree(nextTree);
      } catch (error) {
        if (cancelled) return;
        console.warn("[file-explorer] Failed to load filesystem tree via host", error);
        const fallbackId = joinPaths(scopeRoot, normalizedRoot) || normalizedRoot || scopeRoot || "/";
        const fallbackName = deriveNameFromPath(normalizedRoot || scopeRoot);
        setTree(createRootNode(fallbackId || "/", fallbackName));
      }
    };

    loadTree();

    return () => {
      cancelled = true;
    };
  }, [host, normalizedRoot, scope, fallbackRoot]);

  return tree;
}

export function useFileContent(host: TinyUiHost, filePath: string | null | undefined, scope: FsScope = "workspace") {
  const normalizedPath = useMemo(() => normalizePath(filePath), [filePath]);
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!normalizedPath) {
      setContent("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const bytes = await host.call<Uint8Array>("fs.readFile", { path: normalizedPath, scope });
        if (cancelled) return;
        setContent(textDecoder.decode(bytes));
      } catch (error) {
        if (!cancelled) {
          console.warn("[file-explorer] Failed to read file via host", error);
          setContent("");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [host, normalizedPath, scope]);

  return { content };
}
