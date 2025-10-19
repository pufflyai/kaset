import { getIconComponent } from "../../../utils/getIcon";
import type { HTMLChakraProps, IconButtonProps } from "@chakra-ui/react";
import { AbsoluteCenter, chakra, IconButton } from "@chakra-ui/react";
import { useCallback } from "react";
import { StickToBottom as StickToBottomEl, useStickToBottomContext } from "use-stick-to-bottom";

const ArrowDownIcon = getIconComponent("arrow-down");
const ARROW_ICON_SIZE = 16;

export type ConversationRootProps = HTMLChakraProps<"div", React.ComponentProps<typeof StickToBottomEl>>;

export const ConversationRoot = chakra(
  StickToBottomEl,
  {
    base: {
      position: "relative",
      flex: 1,
      overflowY: "auto",
      height: "full",
    },
  },
  {
    forwardProps: ["resize"],
    defaultProps: {
      "aria-roledescription": "conversation",
      initial: "instant",
      resize: "smooth",
      role: "log",
    },
  },
);

export type ConversationContentProps = HTMLChakraProps<"div">;

export const ConversationContent = chakra(StickToBottomEl.Content, {
  base: {
    p: "sm",
  },
});

export type ConversationScrollButtonProps = IconButtonProps;

export const ConversationScrollButton = (props: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <AbsoluteCenter axis="horizontal" bottom="md">
        <IconButton rounded="full" onClick={handleScrollToBottom} variant="outline" size="xs" {...props}>
          <ArrowDownIcon size={ARROW_ICON_SIZE} />
        </IconButton>
      </AbsoluteCenter>
    )
  );
};
