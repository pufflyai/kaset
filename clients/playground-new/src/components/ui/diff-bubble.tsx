import { Span } from "@chakra-ui/react";

interface DiffBubbleProps {
  fileName: string;
  additions: number;
  deletions: number;
  onClickFileLink?: () => void;
}

export const DiffBubble = (props: DiffBubbleProps) => {
  const { fileName, additions, deletions, onClickFileLink } = props;
  return (
    <Span
      display="inline-flex"
      alignItems="center"
      gap="2xs"
      border="1px solid"
      borderColor="border.secondary"
      color="foreground.secondary"
      paddingX="2xs"
      paddingY="1px"
      borderRadius="xs"
    >
      Edited
      <Span
        mr="xs"
        onClick={(e) => {
          e.stopPropagation();
          onClickFileLink?.();
        }}
        _hover={{
          textDecoration: "underline",
          color: "foreground.blue-dark",
        }}
      >
        {fileName}
      </Span>
      <Span color="foreground.feedback.success">{`+${additions}`}</Span>
      <Span color="foreground.feedback.alert">{`-${deletions}`}</Span>
    </Span>
  );
};
