import { Box, Heading, Text, chakra } from "@chakra-ui/react";
import { useFileContent } from "@pstdio/opfs-hooks";
import { useMemo } from "react";

interface RootFileWindowProps {
  filePath: string;
  displayName: string;
}

export const RootFileWindow = (props: RootFileWindowProps) => {
  const { filePath, displayName } = props;
  const { content } = useFileContent(filePath);

  const pathLabel = useMemo(() => {
    const normalized = filePath.replace(/^\/+/, "");
    return normalized ? `/${normalized}` : "/";
  }, [filePath]);

  const trimmedContent = content.trim();
  const isEmpty = trimmedContent.length === 0;

  return (
    <Box height="100%" display="flex" flexDirection="column" bg="background.primary">
      <Box
        paddingX="lg"
        paddingY="md"
        borderBottomWidth="1px"
        borderColor="border.secondary"
        background="background.secondary"
      >
        <Heading as="h2" size="sm" color="foreground.inverse">
          {displayName}
        </Heading>
        <Text fontSize="xs" color="foreground.tertiary" marginTop="1">
          {pathLabel}
        </Text>
      </Box>
      <Box flex="1" overflow="auto" padding="lg" background="background.primary">
        {isEmpty ? (
          <Text fontSize="sm" color="foreground.tertiary">
            This file is empty.
          </Text>
        ) : (
          <chakra.pre
            whiteSpace="pre-wrap"
            wordBreak="break-word"
            fontFamily="mono"
            fontSize="sm"
            lineHeight="short"
            color="foreground.inverse"
          >
            {content}
          </chakra.pre>
        )}
      </Box>
    </Box>
  );
};
