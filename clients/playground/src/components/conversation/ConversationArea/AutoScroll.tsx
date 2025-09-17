import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

interface AutoScrollProps {
  userMessageCount: number;
}

export const AutoScroll = (props: AutoScrollProps) => {
  const { userMessageCount } = props;
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
