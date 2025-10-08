import { Box, Text, chakra } from "@chakra-ui/react";
import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";

interface DesktopIconProps {
  icon: LucideIcon;
  label: string;
  isSelected?: boolean;
  tabIndex?: number;
  onSelect?: () => void;
  onOpen?: () => void;
  onFocus?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
}

const DesktopIconRoot = chakra.button;

export const DesktopIcon = (props: DesktopIconProps) => {
  const { icon: IconComponent, label, tabIndex = 0, onSelect, onOpen, onFocus, onContextMenu } = props;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onSelect?.();
    onOpen?.();
  };

  return (
    <DesktopIconRoot
      type="button"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="xs"
      width="8rem"
      cursor="pointer"
      tabIndex={tabIndex}
      onClick={(event) => {
        event.preventDefault();
        onSelect?.();
        onOpen?.();
      }}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      onContextMenu={onContextMenu}
    >
      <Box
        background="background.secondary"
        border="1px solid"
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="3rem"
        height="3rem"
        borderRadius="md"
      >
        <IconComponent size={18} />
      </Box>
      <Text textStyle="label/M/medium" color="black" textAlign="center">
        {label}
      </Text>
    </DesktopIconRoot>
  );
};
