import { chakra, Flex } from "@chakra-ui/react";
import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";

const StyledEditable = chakra(LexicalContentEditable);

interface ContentEditableProps {
  onRef?: (elem: HTMLDivElement) => void;
  fullWidth?: boolean;
  padding?: string;
}

export function ContentEditable({ onRef, fullWidth = false, padding }: ContentEditableProps) {
  return (
    <Flex height="100%" overflow="auto" position="relative">
      <Flex ref={onRef} width="100%" padding={padding} justifyContent={fullWidth ? "flex-start" : "center"}>
        <StyledEditable
          height="fit-content"
          minH="100%"
          width="100%"
          maxWidth={fullWidth ? "100%" : "820px"}
          textStyle="paragraph/M/regular"
          position="relative"
          outline="none"
        />
      </Flex>
    </Flex>
  );
}
