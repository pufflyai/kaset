import { Box, Code, Text, Textarea, VStack } from "@chakra-ui/react";
import { useMemo } from "react";
import { useFileContent } from "../hooks/fs";

interface CodeEditorProps {
  filePath?: string | null;
}

export function CodeEditor(props: CodeEditorProps) {
  const { filePath } = props;
  const { content } = useFileContent(filePath);

  const displayPath = useMemo(() => {
    if (!filePath) return "";
    return filePath.split("/").filter(Boolean).join("/");
  }, [filePath]);

  if (!filePath) {
    return (
      <Box padding="4">
        <Text fontSize="sm" color="foreground.tertiary">
          Select a file to view its contents.
        </Text>
      </Box>
    );
  }

  return (
    <VStack align="stretch" height="100%" gap="3" padding="4">
      <VStack align="stretch" gap="1">
        <Text fontSize="xs" textTransform="uppercase" letterSpacing="0.12em" color="foreground.tertiary">
          Viewing
        </Text>
        <Code paddingX="2" paddingY="1" borderRadius="sm" bg="background.tertiary" color="foreground.inverse">
          {displayPath}
        </Code>
      </VStack>

      <Textarea
        value={content}
        readOnly
        spellCheck={false}
        flex="1"
        resize="none"
        fontFamily="mono"
        fontSize="sm"
        lineHeight="short"
        padding="3"
        bg="background.secondary"
        color="foreground.inverse"
        borderRadius="md"
        borderWidth="1px"
        borderColor="border.secondary"
        _focusVisible={{ borderColor: "border.accent", boxShadow: "none" }}
      />
    </VStack>
  );
}
