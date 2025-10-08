import { useEffect, useMemo, useState } from "react";
import { useFsTree, type FsNode } from "../hooks/fs";

interface FileExplorerProps {
  rootDir: string;
  defaultExpanded?: string[];
  selectedPath?: string | null;
  onSelect?: (path: string | null) => void;
}

type ExpandSet = Set<string>;

const buildDefaultExpanded = (rootId: string, defaults?: string[]) => {
  const set: ExpandSet = new Set();
  set.add(rootId);
  defaults?.forEach((id) => {
    if (id) set.add(id);
  });
  return set;
};

const isDirectory = (node: FsNode) => Array.isArray(node.children);

export function FileExplorer(props: FileExplorerProps) {
  const { rootDir, defaultExpanded, selectedPath, onSelect } = props;
  const fsTree = useFsTree(rootDir);

  const defaultSignature = useMemo(() => (defaultExpanded ?? []).join("|"), [defaultExpanded]);
  const [expanded, setExpanded] = useState<ExpandSet>(() => buildDefaultExpanded(fsTree.id, defaultExpanded));

  useEffect(() => {
    setExpanded(buildDefaultExpanded(fsTree.id, defaultExpanded));
  }, [fsTree.id, defaultSignature]);

  const toggle = (node: FsNode) => {
    if (!isDirectory(node)) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  };

  const handleSelect = (node: FsNode) => {
    if (isDirectory(node)) {
      toggle(node);
      return;
    }
    onSelect?.(node.id);
  };

  const renderNode = (node: FsNode) => {
    const expandedNode = expanded.has(node.id);
    const dir = isDirectory(node);
    const isSelected = selectedPath === node.id;

    return (
      <li
        key={node.id}
        style={{
          listStyle: "none",
          paddingLeft: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => handleSelect(node)}
          onDoubleClick={() => (dir ? toggle(node) : undefined)}
          aria-pressed={isSelected}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            width: "100%",
            padding: "4px 6px",
            border: "none",
            borderRadius: "4px",
            background: isSelected ? "#213547" : "transparent",
            color: isSelected ? "#f1f5f9" : "#e2e8f0",
            cursor: "pointer",
            textAlign: "left",
            fontSize: "13px",
            fontFamily: "inherit",
          }}
        >
          <span style={{ width: "12px" }}>{dir ? (expandedNode ? "▼" : "▶") : "•"}</span>
          <span>{node.name}</span>
        </button>
        {dir && expandedNode ? (
          <ul
            style={{
              margin: 0,
              paddingLeft: "12px",
            }}
          >
            {node.children?.map(renderNode)}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        background: "#0f172a",
        borderRadius: "6px",
        padding: "4px 0",
      }}
    >
      <ul
        style={{
          margin: 0,
          padding: 0,
        }}
      >
        {renderNode(fsTree)}
      </ul>
    </div>
  );
}
