import { Box, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { CodeEditor } from "@pstdio/kas-ui";

interface TextEditorProps {
  filePath: string;
}

export const TextEditor = (props: TextEditorProps) => {
  const { filePath } = props;

  const pathLabel = useMemo(() => {
    const normalized = filePath.replace(/^\/+/, "");
    return normalized ? `/${normalized}` : "/";
  }, [filePath]);

  return (
    <Box height="100%" display="flex" flexDirection="column" bg="background.primary">
      <Box paddingX="lg" paddingBottom="md">
        <Text fontSize="xs" color="foreground.secondary" marginTop="1">
          {pathLabel}
        </Text>
      </Box>
      <Box height="100%" overflow="hidden">
        <CodeEditor filePath={filePath} isEditable showLineNumbers wrapLines />
      </Box>
    </Box>
  );
};
