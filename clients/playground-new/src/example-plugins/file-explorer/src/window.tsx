import { Box, Heading, Text } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import { FileExplorer } from "./components/file-explorer";
import { CodeEditor } from "./components/code-editor";

const ROOT_DIR = "playground";

const normalizePath = (path: string | null) => {
  if (!path) return null;
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("/");
};

export default function FileExplorerWindow() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const headerSubtitle = useMemo(() => {
    if (!selectedPath) return "Pick a file to open in the editor";
    const normalized = normalizePath(selectedPath) as string;
    const prefix = `${ROOT_DIR}/`;
    return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  }, [selectedPath]);

  return (
    <Box height="100%" display="flex" backgroundColor="background.primary" color="fg.primary">
      <Box
        width="260px"
        borderRightWidth="1px"
        borderColor="border.secondary"
        display="flex"
        flexDirection="column"
        overflow="hidden"
        backgroundColor="background.secondary"
      >
        <Box padding="md" borderBottomWidth="1px" borderColor="border.secondary">
          <Heading as="h2" fontSize="md" marginBottom="1">
            Playground Files
          </Heading>
          <Text fontSize="xs" color="fg.secondary">
            {headerSubtitle}
          </Text>
        </Box>

        <Box flex="1" overflow="auto" padding="sm">
          <FileExplorer
            rootDir={ROOT_DIR}
            selectedPath={selectedPath}
            onSelect={(path) => setSelectedPath(path)}
            defaultExpanded={[ROOT_DIR]}
          />
        </Box>
      </Box>

      <Box flex="1" display="flex" flexDirection="column" minWidth={0}>
        {selectedPath ? (
          <Box flex="1" minHeight={0}>
            <CodeEditor rootDir={ROOT_DIR} filePath={selectedPath} isEditable showLineNumbers />
          </Box>
        ) : (
          <Box padding="lg" maxWidth="480px" margin="auto" textAlign="center" color="fg.secondary">
            <Heading as="h3" fontSize="lg" marginBottom="2">
              Select a file to preview
            </Heading>
            <Text fontSize="sm">
              Browse the playground directory on the left. When you pick a file, the contents will load here and any
              edits are saved back to OPFS automatically.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
