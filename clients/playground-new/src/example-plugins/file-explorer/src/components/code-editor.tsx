import { Box, Text, Textarea, VStack } from "@chakra-ui/react";
import { useFileContent } from "../hooks/fs";

interface CodeEditorProps {
  filePath?: string | null;
}

export function CodeEditor(props: CodeEditorProps) {
  const { filePath } = props;
  const { content } = useFileContent(filePath);

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
