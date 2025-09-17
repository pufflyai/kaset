import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

export const AutoScroll = ({ userMessageCount }: { userMessageCount: number }) => {
  const { scrollToBottom } = useStickToBottomContext();
  const previousCountRef = useRef(userMessageCount);

  useEffect(() => {
    if (userMessageCount > previousCountRef.current) {
      scrollToBottom();
    }

    previousCountRef.current = userMessageCount;
  }, [userMessageCount, scrollToBottom]);

  return null;
};
