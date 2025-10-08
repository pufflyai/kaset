import { HStack, Spinner, Text } from "@chakra-ui/react";

interface ChangeBubbleProps {
  additions: number;
  deletions: number;
  fileCount: number;
  streaming?: boolean;
}

export const ChangeBubble = (props: ChangeBubbleProps) => {
  const { additions, deletions, fileCount, streaming } = props;
  const fileLabel = fileCount === 1 ? "file" : "files";

  return (
    <HStack
      as="span"
      alignItems="center"
      gap="xs"
      border="1px solid"
      borderColor="border.secondary"
      background="bg.primary"
      paddingX="sm"
      paddingY="2xs"
      borderRadius="sm"
    >
      {streaming ? (
        <HStack alignItems="center" gap="2xs">
          <Spinner size="xs" color="foreground.secondary" />
          <Text textStyle="label/XS" color="foreground.secondary">
            Working
          </Text>
        </HStack>
      ) : (
        <Text textStyle="label/XS" color="foreground.secondary">
          Changes
        </Text>
      )}
      <Text textStyle="label/XS" color="foreground.feedback.success">
        {`+${additions}`}
      </Text>
      <Text textStyle="label/XS" color="foreground.feedback.alert">
        {`-${deletions}`}
      </Text>
      <Text textStyle="label/XS" color="foreground.secondary">
        {`${fileCount} ${fileLabel}`}
      </Text>
    </HStack>
  );
};
