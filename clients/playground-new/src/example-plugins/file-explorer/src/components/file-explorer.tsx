import { TreeView as ChakraTreeView, createTreeCollection } from "@chakra-ui/react";
import { useFolder } from "@pstdio/opfs-hooks";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight, FileText, Folder as FolderIcon } from "lucide-react";
import { useMemo } from "react";
import { useDirIds, useExpandedStateForSelection, useFsTree, useSelectedValueState, type FsNode } from "../hooks/fs";

const resolveFileIcon = (name: string): LucideIcon => {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".md")) return FileText;
  if (normalized.endsWith(".json")) return FileText;
  if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) return FileText;
  if (normalized.endsWith(".js") || normalized.endsWith(".jsx")) return FileText;
  if (normalized.endsWith(".css")) return FileText;
  if (normalized.endsWith(".html")) return FileText;
  return FileText;
};

interface FileExplorerProps {
  rootDir: string;
  defaultExpanded?: string[];
  selectedPath?: string | null;
  onSelect?: (path: string | null) => void;
}

type TreeNode = FsNode & { icon?: LucideIcon };

export function FileExplorer(props: FileExplorerProps) {
  const { rootDir, defaultExpanded, selectedPath, onSelect } = props;
  const { rootNode } = useFolder(rootDir);

  const dirIds = useDirIds(rootDir);
  const fsTree = useFsTree(rootNode, rootDir, dirIds);

  const treeWithIcons = useMemo<TreeNode>(() => {
    const attach = (node: FsNode): TreeNode => {
      const isDirectory = Array.isArray(node.children);
      return {
        id: node.id,
        name: node.name,
        icon: isDirectory ? FolderIcon : resolveFileIcon(node.name),
        children: isDirectory ? (node.children?.map(attach) ?? []) : undefined,
      } satisfies TreeNode;
    };

    return attach(fsTree);
  }, [fsTree]);

  const collection = useMemo(
    () =>
      createTreeCollection({
        rootNode: treeWithIcons,
        nodeToValue: (node) => node.id,
        nodeToString: (node) => node.name,
      }),
    [treeWithIcons],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const visit = (node: TreeNode) => {
      map.set(node.id, node);
      node.children?.forEach(visit);
    };
    visit(treeWithIcons);
    return map;
  }, [treeWithIcons]);

  const [selectedValue, setSelectedValue] = useSelectedValueState(selectedPath);
  const [expanded, setExpanded] = useExpandedStateForSelection({
    defaultExpanded,
    selectedPath,
    rootDir,
    dirIds,
  });

  return (
    <ChakraTreeView.Root
      collection={collection}
      expandedValue={expanded}
      selectedValue={selectedValue}
      onExpandedChange={(event) => setExpanded(event.expandedValue)}
      onSelectionChange={(event) => {
        const value = event.selectedValue[0];
        if (!value) {
          setSelectedValue([]);
          onSelect?.(null);
          return;
        }

        const node = nodeMap.get(value);
        const isDirectory = node && Array.isArray(node.children);

        if (node && !isDirectory) {
          setSelectedValue(event.selectedValue);
          onSelect?.(node.id);
        }
      }}
    >
      <ChakraTreeView.Tree>
        <ChakraTreeView.Node
          indentGuide={<ChakraTreeView.BranchIndentGuide />}
          render={({ node, nodeState }) => {
            const isDirectory = Array.isArray(node.children);
            const Icon = (node.icon as LucideIcon | undefined) ?? FileText;

            if (isDirectory) {
              return (
                <ChakraTreeView.BranchControl cursor="pointer">
                  {nodeState.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Icon size={16} />
                  <ChakraTreeView.BranchText truncate>{node.name}</ChakraTreeView.BranchText>
                </ChakraTreeView.BranchControl>
              );
            }

            return (
              <ChakraTreeView.Item cursor="pointer">
                <Icon size={16} />
                <ChakraTreeView.ItemText truncate>{node.name}</ChakraTreeView.ItemText>
              </ChakraTreeView.Item>
            );
          }}
        />
      </ChakraTreeView.Tree>
    </ChakraTreeView.Root>
  );
}
