import { TreeView as ChakraTreeView, createTreeCollection, Menu, Portal } from "@chakra-ui/react";
import { useFolder } from "@pstdio/opfs-hooks";
import { getDirectoryHandle, ls } from "@pstdio/opfs-utils";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronRight, Download, Folder, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getFileTypeIcon } from "../../utils/getFileTypeIcon";
import { DeleteConfirmationModal } from "./delete-confirmation-modal";
import { MenuItem } from "./menu-item";

export interface Node {
  id: string;
  name: string;
  children?: Node[];
  icon?: LucideIcon;
}

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

  // Keep internal selection in sync with provided prop
  useEffect(() => {
    if (selectedValueProp) setSelectedValue(selectedValueProp);
    else setSelectedValue([]);
  }, [selectedValueProp]);

  // Keep internal expanded in sync with provided prop
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

  // Track known directory IDs (including empty ones) so they render as folders
  const [dirIds, setDirIds] = useState<Set<string>>(new Set());

  // Build a set of directory IDs using OPFS ls so empty folders are included
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const handle = await getDirectoryHandle(rootDir);
        const entries = await ls(handle, { maxDepth: Infinity, kinds: ["directory"] });

        const prefix = rootDir ? rootDir.replace(/\/+$/, "") + "/" : "";
        const next = new Set<string>();

        // Include the root directory itself
        next.add(rootDir);

        for (const e of entries) {
          next.add(prefix + e.path);
        }

        if (!cancelled) setDirIds(next);
      } catch (err) {
        // If we fail to list, keep existing set (fallback behavior)
        console.warn("Failed to list directories for FileExplorer:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rootDir]);

  const fileTree = useMemo<Node>(() => {
    type OpfsNode = {
      id: string;
      name: string;
      children?: OpfsNode[];
    };

    const mapNode = (node: OpfsNode): Node => {
      const hasChildrenArray = Array.isArray(node.children);
      const isDir = hasChildrenArray || dirIds.has(node.id);

      return {
        id: node.id,
        name: node.name,
        icon: isDir ? Folder : undefined,
        // For empty directories, ensure children is an empty array so they render as branches
        children: isDir ? (node.children ? node.children.map(mapNode) : []) : undefined,
      } satisfies Node;
    };

    if (rootNode && typeof rootNode === "object") {
      return mapNode(rootNode as OpfsNode);
    }

    return {
      id: rootDir,
      name: rootDir,
      icon: Folder,
      children: [],
    } satisfies Node;
  }, [rootNode, rootDir, dirIds]);

  const [selectedValue, setSelectedValue] = useState<string[]>(selectedPath ? [selectedPath] : []);
  const [expanded, setExpanded] = useState<string[]>(defaultExpanded ?? []);

  useEffect(() => {
    if (!selectedPath) {
      setSelectedValue([]);
      return;
    }

    setSelectedValue([selectedPath]);
  }, [selectedPath]);

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
          const dir = await getDirectoryHandle(rootDir);

          // Compute the path relative to the provided rootDir,
          // regardless of how many segments rootDir contains.
          const idParts = node.id.split("/").filter(Boolean);
          const rootParts = rootDir.split("/").filter(Boolean);

          const hasRootPrefix = idParts.slice(0, rootParts.length).join("/") === rootDir;
          const relParts = hasRootPrefix ? idParts.slice(rootParts.length) : idParts;

          // Navigate to the parent directory of the target file
          let currentDir: FileSystemDirectoryHandle = dir;
          for (let i = 0; i < Math.max(0, relParts.length - 1); i++) {
            currentDir = await currentDir.getDirectoryHandle(relParts[i]);
          }

          const fileName = relParts[relParts.length - 1];
          if (fileName) {
            await currentDir.removeEntry(fileName);
          }

          // If we just deleted the currently selected file, move selection.
          if ((selectedPath ?? null) === node.id) {
            // Prefer another file in the same directory.
            const siblings = await ls(currentDir, { maxDepth: 1, kinds: ["file"], sortBy: "name" });

            const dirRelParts = relParts.slice(0, -1);
            const dirRelPath = dirRelParts.join("/");

            const toAbs = (name: string) => [rootDir, dirRelPath, name].filter((s) => !!s && s.length > 0).join("/");

            let nextPath: string | null = null;

            if (siblings.length > 0) {
              // Pick the first sibling by name (already sorted)
              nextPath = toAbs(siblings[0].name);
            } else {
              // Otherwise, pick the first file anywhere under the project root
              const all = await ls(dir, {
                maxDepth: Infinity,
                kinds: ["file"],
                sortBy: "path",
                dirsFirst: false,
              });

              if (all.length > 0) {
                // all[i].path is relative to dir (rootDir)
                nextPath = [rootDir, all[0].path].filter(Boolean).join("/");
              }
            }

            if (nextPath) {
              setSelectedValue([nextPath]);
              onSelect?.(nextPath);
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
