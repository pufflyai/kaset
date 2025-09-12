import { TreeView as ChakraTreeView, createTreeCollection, Menu, Portal } from "@chakra-ui/react";
import { useFolder } from "@pstdio/opfs-hooks";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight, Download, Folder, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteFileNode } from "../../services/fs/actions";
import { useDirIds, useExpandedStateForSelection, useFsTree, useSelectedValueState } from "../../services/fs/hooks";
import type { FsNode } from "../../services/fs/types";
import { getFileTypeIcon } from "../../utils/getFileTypeIcon";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { MenuItem } from "./menu-item";

type Node = FsNode & { icon?: LucideIcon };

export interface TreeViewProps {
  rootNode: Node;
  defaultExpanded?: string[];
  label?: string;
  onSelect?: (node: Node) => void;
  onDelete?: (node: Node) => void;
  onDownload?: (node: Node) => void;
  selectedValue?: string[];
  expandedValue?: string[];
  onExpandedChange?: (expanded: string[]) => void;
}

export function TreeView({
  rootNode,
  defaultExpanded = [],
  onSelect,
  onDelete,
  onDownload,
  selectedValue: selectedValueProp,
  expandedValue: expandedValueProp,
  onExpandedChange,
}: TreeViewProps) {
  const collection = useMemo(
    () =>
      createTreeCollection({
        rootNode,
        nodeToValue: (node) => node.id,
        nodeToString: (node) => node.name,
      }),
    [rootNode],
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>();
    const walk = (node: Node) => {
      map.set(node.id, node);
      node.children?.forEach(walk);
    };
    walk(rootNode);
    return map;
  }, [rootNode]);

  const [expandedValue, setExpandedValue] = useState<string[]>(expandedValueProp ?? defaultExpanded);
  const [selectedValue, setSelectedValue] = useState<string[]>(selectedValueProp ?? []);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<Node | null>(null);

  useEffect(() => {
    if (selectedValueProp) setSelectedValue(selectedValueProp);
    else setSelectedValue([]);
  }, [selectedValueProp]);

  useEffect(() => {
    if (expandedValueProp) setExpandedValue(expandedValueProp);
    else setExpandedValue(defaultExpanded);
  }, [expandedValueProp, defaultExpanded]);

  const handleDeleteClick = (node: Node) => {
    setNodeToDelete(node);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (nodeToDelete && onDelete) {
      await onDelete(nodeToDelete);
    }
    setDeleteModalOpen(false);
    setNodeToDelete(null);
  };

  const handleDeleteCancel = () => {
    setDeleteModalOpen(false);
    setNodeToDelete(null);
  };

  return (
    <>
      <ChakraTreeView.Root
        collection={collection}
        expandedValue={expandedValue}
        selectedValue={selectedValue}
        onExpandedChange={(e) => {
          setExpandedValue(e.expandedValue);
          onExpandedChange?.(e.expandedValue);
        }}
        onSelectionChange={(e) => {
          const selected = e.selectedValue[0];
          const node = selected ? nodeMap.get(selected) : undefined;
          if (selected && node && !node.children) {
            setSelectedValue(e.selectedValue);
            onSelect?.(node);
          }
        }}
      >
        <ChakraTreeView.Tree>
          <ChakraTreeView.Node
            indentGuide={<ChakraTreeView.BranchIndentGuide />}
            render={({ node, nodeState }) =>
              node.children ? (
                <ChakraTreeView.BranchControl cursor="pointer">
                  {nodeState.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {node.icon && <node.icon size={16} />}
                  <ChakraTreeView.BranchText truncate>{node.name}</ChakraTreeView.BranchText>
                </ChakraTreeView.BranchControl>
              ) : (
                <Menu.Root>
                  <Menu.ContextTrigger asChild>
                    <ChakraTreeView.Item cursor="pointer">
                      {(() => {
                        const IconComp = (node.icon as LucideIcon | undefined) ?? getFileTypeIcon(node.name);
                        return <IconComp size={16} />;
                      })()}
                      <ChakraTreeView.ItemText truncate>{node.name}</ChakraTreeView.ItemText>
                    </ChakraTreeView.Item>
                  </Menu.ContextTrigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content bg="background.primary">
                        {onDownload && (
                          <MenuItem
                            leftIcon={<Download size={16} />}
                            primaryLabel="Download"
                            onClick={() => onDownload(node)}
                          />
                        )}
                        {onDelete && (
                          <MenuItem
                            leftIcon={<Trash2 size={16} />}
                            primaryLabel="Delete"
                            onClick={() => handleDeleteClick(node)}
                          />
                        )}
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              )
            }
          />
        </ChakraTreeView.Tree>
      </ChakraTreeView.Root>

      <DeleteConfirmationModal
        open={deleteModalOpen}
        onClose={handleDeleteCancel}
        onDelete={handleDeleteConfirm}
        headline="Delete File"
        notificationText={`Are you sure you want to delete "${nodeToDelete?.name}"? This action cannot be undone.`}
        buttonText="Delete"
      />
    </>
  );
}

export interface FileExplorerProps {
  rootDir: string;
  defaultExpanded?: string[];
  onSelect?: (path: string | null) => void;
  selectedPath?: string | null;
}

export function FileExplorer({ rootDir, defaultExpanded, onSelect, selectedPath }: FileExplorerProps) {
  const { rootNode } = useFolder(rootDir);

  const dirIds = useDirIds(rootDir);
  const fsTree = useFsTree(rootNode, rootDir, dirIds);

  const fileTree = useMemo<Node>(() => {
    const addIcons = (n: FsNode): Node => ({
      id: n.id,
      name: n.name,
      icon: n.children ? Folder : undefined,
      children: n.children ? n.children.map(addIcons) : undefined,
    });

    return addIcons(fsTree);
  }, [fsTree]);

  const [selectedValue, setSelectedValue] = useSelectedValueState(selectedPath);
  const [expanded, setExpanded] = useExpandedStateForSelection({
    defaultExpanded,
    selectedPath,
    rootDir,
    dirIds,
  });

  return (
    <TreeView
      rootNode={fileTree}
      defaultExpanded={defaultExpanded}
      expandedValue={expanded}
      onExpandedChange={(vals) => setExpanded(vals)}
      selectedValue={selectedValue}
      onSelect={(node) => {
        setSelectedValue([node.id]);
        onSelect?.(node.id);
      }}
      onDelete={async (node) => {
        try {
          const suggested = await deleteFileNode({
            rootDir,
            nodeId: node.id,
            selectedPath,
          });

          if (suggested !== undefined) {
            if (suggested) {
              setSelectedValue([suggested]);
              onSelect?.(suggested);
            } else {
              setSelectedValue([]);
              onSelect?.(null);
            }
          }
        } catch (err) {
          console.error("Failed to delete file:", err);
        }
      }}
    />
  );
}
