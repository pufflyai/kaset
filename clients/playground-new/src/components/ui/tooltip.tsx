import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react";
import * as React from "react";

export interface TooltipProps extends ChakraTooltip.RootProps {
  children?: React.ReactElement;
  showArrow?: boolean;
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  content: React.ReactNode;
  contentProps?: ChakraTooltip.ContentProps;
  disabled?: boolean;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(function Tooltip(props, ref) {
  const { showArrow, children, disabled, portalled = true, content, contentProps, portalRef, ...rest } = props;

  const isEmptyContent = (node: React.ReactNode): boolean => {
    if (node === null || node === undefined || node === false) return true;
    const arr = React.Children.toArray(node);
    if (arr.length === 0) return true;
    return arr.every((child) => (typeof child === "string" ? child.trim().length === 0 : false));
  };

  if (disabled || isEmptyContent(content)) return children;

  return (
    <ChakraTooltip.Root openDelay={100} closeDelay={100} {...rest}>
      <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
      <Portal disabled={!portalled} container={portalRef}>
        <ChakraTooltip.Positioner>
          <ChakraTooltip.Content ref={ref} {...contentProps}>
            {showArrow && (
              <ChakraTooltip.Arrow>
                <ChakraTooltip.ArrowTip />
              </ChakraTooltip.Arrow>
            )}
            {content}
          </ChakraTooltip.Content>
        </ChakraTooltip.Positioner>
      </Portal>
    </ChakraTooltip.Root>
  );
});
