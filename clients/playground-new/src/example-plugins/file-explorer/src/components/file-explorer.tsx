import { Box, TreeView as ChakraTreeView, createTreeCollection } from "@chakra-ui/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFsTree, type FsNode } from "../hooks/fs";

interface FileExplorerProps {
  rootDir: string;
  defaultExpanded?: string[];
  selectedPath?: string | null;
  onSelect?: (path: string | null) => void;
}

const buildDefaultExpanded = (rootId: string, defaults?: string[]) => {
  const values = new Set<string>();
  values.add(rootId);
  defaults?.forEach((id) => {
    if (id) values.add(id);
  });
  return Array.from(values);
};

const isDirectory = (node: FsNode) => Array.isArray(node.children);

export function FileExplorer(props: FileExplorerProps) {
  const { rootDir, defaultExpanded, selectedPath, onSelect } = props;
  const fsTree = useFsTree(rootDir);

  const collection = useMemo(
    () =>
      createTreeCollection({
        rootNode: fsTree,
        nodeToValue: (node) => node.id,
        nodeToString: (node) => node.name,
      }),
    [fsTree],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, FsNode>();

    const walk = (node: FsNode) => {
      map.set(node.id, node);
      node.children?.forEach(walk);
    };

    walk(fsTree);
    return map;
  }, [fsTree]);

  const [expandedValue, setExpandedValue] = useState<string[]>(() => buildDefaultExpanded(fsTree.id, defaultExpanded));
  const [selectedValue, setSelectedValue] = useState<string[]>(selectedPath ? [selectedPath] : []);
  const defaultSignature = useMemo(() => (defaultExpanded ?? []).join("|"), [defaultExpanded]);

  useEffect(() => {
    setExpandedValue(buildDefaultExpanded(fsTree.id, defaultExpanded));
  }, [fsTree.id, defaultSignature]);

  useEffect(() => {
    setSelectedValue(selectedPath ? [selectedPath] : []);
  }, [selectedPath]);

  return (
    <Box height="100%" overflowY="auto" paddingY="2">
      <ChakraTreeView.Root
        collection={collection}
        expandedValue={expandedValue}
        selectedValue={selectedValue}
        onExpandedChange={(event) => setExpandedValue(event.expandedValue)}
        onSelectionChange={(event) => {
          const next = event.selectedValue[0];
          const node = next ? nodeMap.get(next) : undefined;
          if (!next) {
            setSelectedValue([]);
            onSelect?.(null);
            return;
          }

          if (node && !isDirectory(node)) {
            setSelectedValue(event.selectedValue);
            onSelect?.(node.id);
          }
        }}
      >
        <ChakraTreeView.Tree>
          <ChakraTreeView.Node
            indentGuide={<ChakraTreeView.BranchIndentGuide />}
            render={({ node, nodeState }) =>
              isDirectory(node) ? (
                <ChakraTreeView.BranchControl cursor="pointer">
                  {nodeState.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <ChakraTreeView.BranchText truncate>{node.name}</ChakraTreeView.BranchText>
                </ChakraTreeView.BranchControl>
              ) : (
                <ChakraTreeView.Item cursor="pointer">
                  <ChakraTreeView.ItemText truncate>{node.name}</ChakraTreeView.ItemText>
                </ChakraTreeView.Item>
              )
            }
          />
        </ChakraTreeView.Tree>
      </ChakraTreeView.Root>
    </Box>
  );
}
