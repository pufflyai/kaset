import { useEffect } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

export const AutoScroll = ({ userMessageCount }: { userMessageCount: number }) => {
  const { scrollToBottom } = useStickToBottomContext();

  useEffect(() => {
    scrollToBottom();
  }, [userMessageCount, scrollToBottom]);

  return null;
};
