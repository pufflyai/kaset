import { Box, Breadcrumb, Flex, Text } from "@chakra-ui/react";
import type { FsScope } from "@pstdio/tiny-plugins";
import { FileText, FolderClosed } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TinyUiHost } from "../host";
import { useFsTree, type FsNode } from "../hooks/fs";

interface FileExplorerProps {
  host: TinyUiHost;
  rootDir: string;
  scope?: FsScope;
  requestedPath?: string | null;
  onOpenFile?: (path: string, options?: { displayName?: string }) => Promise<void> | void;
}

const isDirectory = (node: FsNode) => Array.isArray(node.children);

const buildMaps = (root: FsNode) => {
  const nodeMap = new Map<string, FsNode>();
  const parentMap = new Map<string, string | null>();

  const walk = (node: FsNode, parentId: string | null) => {
    nodeMap.set(node.id, node);
    parentMap.set(node.id, parentId);
    node.children?.forEach((child) => walk(child, node.id));
  };

  walk(root, null);
  return { nodeMap, parentMap };
};

const createBreadcrumbs = (currentId: string, maps: ReturnType<typeof buildMaps>): { id: string; label: string }[] => {
  const crumbs: { id: string; label: string }[] = [];
  let cursor: string | null = currentId;

  while (cursor) {
    const node = maps.nodeMap.get(cursor);
    if (!node) break;
    crumbs.push({ id: node.id, label: node.name || "/" });
    cursor = maps.parentMap.get(cursor) ?? null;
  }

  return crumbs.reverse();
};

export function FileExplorer(props: FileExplorerProps) {
  const { host, rootDir, scope = "workspace", onOpenFile, requestedPath } = props;
  const fsTree = useFsTree(host, rootDir, scope);

  const maps = useMemo(() => buildMaps(fsTree), [fsTree]);
  const [currentPath, setCurrentPath] = useState<string>(fsTree.id);

  useEffect(() => {
    setCurrentPath(fsTree.id);
  }, [fsTree.id]);

  useEffect(() => {
    if (typeof requestedPath !== "string") return;

    const trimmed = requestedPath.trim();
    if (!trimmed) return;

    const fallback = maps.nodeMap.get(fsTree.id) ?? fsTree;
    const resolveRequestedNode = () => {
      const exact = maps.nodeMap.get(trimmed);
      if (exact) return exact;

      const segments = trimmed.split("/").filter((segment) => segment.length > 0);
      for (let index = segments.length - 1; index > 0; index -= 1) {
        const candidate = segments.slice(0, index).join("/");
        const ancestor = maps.nodeMap.get(candidate);
        if (ancestor) return ancestor;
      }

      return fallback;
    };

    const target = resolveRequestedNode();
    if (!target) return;

    // Only honor requested paths when they differ from the current selection so manual navigation persists.
    setCurrentPath((previous) => {
      if (target.id === previous) return previous;
      return target.id;
    });
  }, [requestedPath, maps, fsTree]);

  const currentNode = maps.nodeMap.get(currentPath) ?? fsTree;
  const breadcrumbs = useMemo(() => createBreadcrumbs(currentNode.id, maps), [currentNode.id, maps]);

  const entries = currentNode.children ?? [];

  return (
    <Flex direction="column" width="100%" height="100%" gap="4" padding="4">
      <Breadcrumb.Root>
        <Breadcrumb.List>
          {breadcrumbs.map((crumb, index) => (
            <>
              {index > 0 && <Breadcrumb.Separator />}
              <Breadcrumb.Item key={crumb.id}>
                <Breadcrumb.Link
                  onClick={(event) => {
                    event.preventDefault();
                    if (index === breadcrumbs.length - 1) return;
                    setCurrentPath(crumb.id);
                  }}
                  color={index === breadcrumbs.length - 1 ? "foreground.subtle" : undefined}
                  _hover={{ textDecoration: index === breadcrumbs.length - 1 ? "none" : "underline" }}
                  cursor={index === breadcrumbs.length - 1 ? "default" : "pointer"}
                >
                  {crumb.label}
                </Breadcrumb.Link>
              </Breadcrumb.Item>
            </>
          ))}
        </Breadcrumb.List>
      </Breadcrumb.Root>

      {entries.length === 0 && (
        <Flex
          flex="1"
          align="center"
          justify="center"
          borderRadius="md"
          borderWidth="1px"
          borderStyle="dashed"
          borderColor="border.subtle"
          padding="6"
          gridColumn={{ base: "1 / span 2", sm: "1 / span 3", md: "1 / span 4", lg: "1 / span 5" }}
        >
          <Text color="foreground.subtle" textAlign="center">
            This folder is empty
          </Text>
        </Flex>
      )}

      <Box
        display="grid"
        gap="1"
        alignContent="start"
        justifyContent="start"
        justifyItems="center"
        gridTemplateColumns="repeat(auto-fit, minmax(5rem, max-content))"
      >
        {entries.map((node) => {
          const directory = isDirectory(node);
          return (
            <Flex
              key={node.id}
              direction="column"
              align="center"
              gap="1"
              padding="4"
              borderRadius="md"
              cursor={"pointer"}
              _hover={{
                background: "gray.100",
              }}
              onClick={() => {
                if (directory) {
                  console.info("[file-explorer] Navigating into directory", { id: node.id });
                  setCurrentPath(node.id);
                  return;
                }

                console.info("[file-explorer] Requesting host to open file", { id: node.id, name: node.name });
                const result = onOpenFile?.(node.id, { displayName: node.name });
                if (result instanceof Promise) {
                  result.catch((error) => {
                    console.error("[file-explorer] Failed to open file", error);
                  });
                }
              }}
            >
              <Box
                transition="background 120ms ease"
                display="flex"
                alignItems="center"
                justifyContent="center"
                width="3rem"
                height="3rem"
                borderRadius="md"
              >
                {directory ? <FolderClosed size={32} /> : <FileText size={32} />}
              </Box>
              <Text
                lineClamp={2}
                textAlign="center"
                fontSize="sm"
                width="100%"
                whiteSpace="normal"
                wordBreak="break-word"
              >
                {node.name}
              </Text>
            </Flex>
          );
        })}
      </Box>
    </Flex>
  );
}
