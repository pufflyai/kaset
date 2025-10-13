import { Box, Breadcrumb, Flex, SimpleGrid, Text } from "@chakra-ui/react";
import { FileText, Folder } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFsTree, type FsNode } from "../hooks/fs";

interface FileExplorerProps {
  rootDir: string;
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
  const { rootDir } = props;
  const fsTree = useFsTree(rootDir);

  const maps = useMemo(() => buildMaps(fsTree), [fsTree]);
  const [currentPath, setCurrentPath] = useState<string>(fsTree.id);

  useEffect(() => {
    setCurrentPath(fsTree.id);
  }, [fsTree.id]);

  const currentNode = maps.nodeMap.get(currentPath) ?? fsTree;
  const breadcrumbs = useMemo(() => createBreadcrumbs(currentNode.id, maps), [currentNode.id, maps]);

  const entries = currentNode.children ?? [];

  return (
    <Flex direction="column" height="100%" gap="4" padding="4">
      <Breadcrumb.Root textStyle="body/S/medium" color="foreground.tertiary">
        <Breadcrumb.List>
          {breadcrumbs.map((crumb, index) => (
            <Breadcrumb.Item key={crumb.id}>
              <Breadcrumb.Link
                onClick={(event) => {
                  event.preventDefault();
                  if (index === breadcrumbs.length - 1) return;
                  setCurrentPath(crumb.id);
                }}
                color={index === breadcrumbs.length - 1 ? "foreground.secondary" : undefined}
                _hover={{ textDecoration: index === breadcrumbs.length - 1 ? "none" : "underline" }}
                cursor={index === breadcrumbs.length - 1 ? "default" : "pointer"}
              >
                {crumb.label}
              </Breadcrumb.Link>
            </Breadcrumb.Item>
          ))}
        </Breadcrumb.List>
      </Breadcrumb.Root>

      <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} gap="4" flex="1" alignContent="flex-start">
        {entries.length === 0 && (
          <Flex
            align="center"
            justify="center"
            borderRadius="md"
            borderWidth="1px"
            borderStyle="dashed"
            borderColor="border.secondary"
            padding="6"
            gridColumn={{ base: "1 / span 2", sm: "1 / span 3", md: "1 / span 4", lg: "1 / span 5" }}
          >
            <Text color="foreground.tertiary" textAlign="center">
              This folder is empty
            </Text>
          </Flex>
        )}
        {entries.map((node) => {
          const directory = isDirectory(node);
          return (
            <Flex
              key={node.id}
              direction="column"
              align="center"
              gap="2"
              padding="4"
              borderRadius="md"
              bg="background.secondary"
              borderWidth="1px"
              borderColor="border.secondary"
              cursor={directory ? "pointer" : "default"}
              onClick={() => {
                if (directory) setCurrentPath(node.id);
              }}
            >
              <Box color={directory ? "blue.300" : "foreground.secondary"}>
                {directory ? <Folder size={32} /> : <FileText size={32} />}
              </Box>
              <Text textAlign="center" fontSize="sm" width="100%" whiteSpace="normal" wordBreak="break-word">
                {node.name}
              </Text>
            </Flex>
          );
        })}
      </SimpleGrid>
    </Flex>
  );
}
