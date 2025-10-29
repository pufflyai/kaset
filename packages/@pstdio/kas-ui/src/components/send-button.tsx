import { IconButton, type IconButtonProps, Kbd, Portal, Tooltip } from "@chakra-ui/react";
import type { ReactElement } from "react";

export interface SendButtonProps extends IconButtonProps {
  icon?: ReactElement;
  active?: boolean;
  shortcut?: string;
  title?: string;
}

export const SendButton = (props: SendButtonProps) => {
  const { icon, title, active, shortcut, ...rest } = props;

  const button = (
    <IconButton
      size="sm"
      variant="solid"
      borderRadius="full"
      colorPalette="primary"
      aria-pressed={active ?? false}
      {...rest}
    >
      {icon}
    </IconButton>
  );

  if (title) {
    const tooltipContent = shortcut ? (
      <>
        {title} <Kbd fontSize="xs">{shortcut}</Kbd>
      </>
    ) : (
      title
    );

    return (
      <Tooltip.Root closeDelay={50} openDelay={100}>
        <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
        <Portal>
          <Tooltip.Positioner>
            <Tooltip.Content>{tooltipContent}</Tooltip.Content>
          </Tooltip.Positioner>
        </Portal>
      </Tooltip.Root>
    );
  }

  return button;
};
