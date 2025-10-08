import { useEffect, useMemo, useState } from "react";
import type { FsNode } from "./types";

// Normalize an OPFS tree so directories always have a children array (even when empty)
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

// Keep an internal selectedValue array in sync with a single selectedPath
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

// Manage expanded state and auto-expand parent directories for the current selection
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
    for (let i = 0; i < ensureRootPrefixed.length - 1; i++) {
      const dirPath = ensureRootPrefixed.slice(0, i + 1).join("/");
      if (dirIds.has(dirPath)) parentDirs.push(dirPath);
    }

    setExpanded((prev) => Array.from(new Set([...prev, ...parentDirs])));
  }, [selectedPath, rootDir, dirIds]);

  return [expanded, setExpanded] as const;
}
