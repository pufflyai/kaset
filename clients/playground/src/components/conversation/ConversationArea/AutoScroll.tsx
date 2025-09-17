import { useEffect, useLayoutEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";

interface AutoScrollProps {
  userMessageCount: number;
}

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const AutoScroll = (props: AutoScrollProps) => {
  const { userMessageCount } = props;
  const { scrollToBottom } = useStickToBottomContext();
  const hasScrolledInitiallyRef = useRef(false);
  const previousCountRef = useRef(userMessageCount);

  useIsomorphicLayoutEffect(() => {
    if (hasScrolledInitiallyRef.current) {
      return;
    }

    hasScrolledInitiallyRef.current = true;
    scrollToBottom({ animation: "instant" });
  }, [scrollToBottom]);

  useEffect(() => {
    if (userMessageCount > previousCountRef.current) {
      scrollToBottom();
    }

    previousCountRef.current = userMessageCount;
  }, [userMessageCount, scrollToBottom]);

  return null;
};
