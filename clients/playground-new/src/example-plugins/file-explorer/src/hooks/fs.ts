import { useEffect, useMemo, useState } from "react";
import { getDirectoryHandle, ls } from "@pstdio/opfs-utils";

export interface FsNode {
  id: string;
  name: string;
  children?: FsNode[];
}

export function useDirIds(rootDir: string) {
  const [dirIds, setDirIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await getDirectoryHandle(rootDir);
        const entries = await ls(rootDir, { maxDepth: Infinity, kinds: ["directory"] });

        const prefix = rootDir ? rootDir.replace(/\/+$/, "") + "/" : "";
        const next = new Set<string>();

        next.add(rootDir);

        for (const entry of entries) {
          next.add(prefix + entry.path);
        }

        if (!cancelled) setDirIds(next);
      } catch (error) {
        console.warn("useDirIds: failed to list directories", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rootDir]);

  return dirIds;
}

export function useFsTree(rootNode: any, rootDir: string, dirIds: Set<string>) {
  const fileTree = useMemo<FsNode>(() => {
    type OpfsNode = {
      id: string;
      name: string;
      children?: OpfsNode[];
    };

    const mapNode = (node: OpfsNode): FsNode => {
      const hasChildrenArray = Array.isArray(node.children);
      const isDir = hasChildrenArray || dirIds.has(node.id);

      return {
        id: node.id,
        name: node.name,
        children: isDir ? (node.children ? node.children.map(mapNode) : []) : undefined,
      } satisfies FsNode;
    };

    if (rootNode && typeof rootNode === "object") {
      return mapNode(rootNode as OpfsNode);
    }

    return {
      id: rootDir,
      name: rootDir,
      children: [],
    } satisfies FsNode;
  }, [rootNode, rootDir, dirIds]);

  return fileTree;
}

export function useSelectedValueState(selectedPath?: string | null) {
  const [selectedValue, setSelectedValue] = useState<string[]>(selectedPath ? [selectedPath] : []);

  useEffect(() => {
    if (!selectedPath) {
      setSelectedValue([]);
      return;
    }
    setSelectedValue([selectedPath]);
  }, [selectedPath]);

  return [selectedValue, setSelectedValue] as const;
}

export function useExpandedStateForSelection(args: {
  defaultExpanded?: string[];
  selectedPath?: string | null;
  rootDir: string;
  dirIds: Set<string>;
}) {
  const { defaultExpanded, selectedPath, rootDir, dirIds } = args;
  const [expanded, setExpanded] = useState<string[]>(defaultExpanded ?? []);

  useEffect(() => {
    if (!selectedPath) return;

    const rootParts = rootDir.split("/").filter(Boolean);
    const parts = selectedPath.split("/").filter(Boolean);

    const hasRootPrefix = parts.slice(0, rootParts.length).join("/") === rootDir;
    const ensureRootPrefixed = hasRootPrefix ? parts : [...rootParts, ...parts];

    const parentDirs: string[] = [];
    for (let index = 0; index < ensureRootPrefixed.length - 1; index += 1) {
      const dirPath = ensureRootPrefixed.slice(0, index + 1).join("/");
      if (dirIds.has(dirPath)) parentDirs.push(dirPath);
    }

    setExpanded((prev) => Array.from(new Set([...prev, ...parentDirs])));
  }, [selectedPath, rootDir, dirIds]);

  return [expanded, setExpanded] as const;
}
