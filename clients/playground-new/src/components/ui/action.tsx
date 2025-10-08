import { IconButton, type IconButtonProps, Kbd, Portal, Span, Tooltip } from "@chakra-ui/react";

export interface ActionProps extends IconButtonProps {
  icon?: React.ReactElement;
  active?: boolean;
  shortcut?: string;
}

export const Action = (props: ActionProps) => {
  const { icon, title, active, shortcut, ...rest } = props;

  const button = (
    <IconButton
      size="xs"
      variant="ghost"
      bg={active ? "background.subtle" : "transparent"}
      _hover={{ bg: active ? "background.tertiary" : "background.subtle" }}
      colorPalette="secondary"
      {...rest}
    >
      {icon}
      <Span srOnly>{title}</Span>
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
