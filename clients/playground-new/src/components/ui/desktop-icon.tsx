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
  const { icon: IconComponent, label, isSelected, tabIndex = 0, onSelect, onOpen, onFocus, onContextMenu } = props;

  const labelStyles = {
    color: { base: "foreground.primary", _dark: "foreground.inverse" },
    bg: { base: "rgba(255, 255, 255, 0.86)", _dark: "rgba(17, 17, 27, 0.72)" },
  } as const;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onSelect?.();
    onOpen?.();
  };

  return (
    <DesktopIconRoot
      className="group"
      type="button"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="2xs"
      maxWidth="5rem"
      cursor="pointer"
      position="relative"
      transition="transform 120ms ease, filter 120ms ease"
      _hover={{ transform: "translateY(-2px)" }}
      _focusVisible={{ boxShadow: "0 0 0 2px rgba(59, 130, 246, 0.6)" }}
      data-selected={isSelected ? "true" : undefined}
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
        _groupHover={{ background: "background.secondary" }}
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="3rem"
        height="3rem"
        borderRadius="md"
      >
        <IconComponent size={24} />
      </Box>
      <Text
        textStyle="label/S/medium"
        color={labelStyles.color}
        textAlign="center"
        px="2xs"
        paddingTop="1px"
        _groupHover={{ textDecoration: "underline" }}
        bg={labelStyles.bg}
        maxWidth="100%"
        width="fit-content"
        mx="auto"
        wordBreak="break-word"
        backdropFilter="blur(6px)"
        transition="all 120ms ease"
      >
        {label}
      </Text>
    </DesktopIconRoot>
  );
};
