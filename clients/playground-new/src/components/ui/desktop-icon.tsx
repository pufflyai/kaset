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
    boxShadow: {
      base: "0 0 0 1px rgba(17, 24, 39, 0.05), 0 6px 12px rgba(15, 23, 42, 0.12)",
      _dark: "0 0 0 1px rgba(255, 255, 255, 0.16), 0 6px 14px rgba(2, 6, 23, 0.6)",
    },
  } as const;

  const selectedLabelStyles = {
    color: { base: "blue.700", _dark: "blue.100" },
    bg: { base: "rgba(59, 130, 246, 0.2)", _dark: "rgba(59, 130, 246, 0.42)" },
    boxShadow: {
      base: "0 0 0 1px rgba(37, 99, 235, 0.24), 0 8px 18px rgba(37, 99, 235, 0.24)",
      _dark: "0 0 0 1px rgba(96, 165, 250, 0.4), 0 10px 22px rgba(8, 15, 35, 0.7)",
    },
  } as const;

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
      position="relative"
      transition="transform 120ms ease, filter 120ms ease"
      _hover={{ transform: "translateY(-2px)", filter: "brightness(1.05)" }}
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
      <Text
        textStyle="label/M/medium"
        color={isSelected ? selectedLabelStyles.color : labelStyles.color}
        textAlign="center"
        px="xs"
        py="2xs"
        borderRadius="sm"
        bg={isSelected ? selectedLabelStyles.bg : labelStyles.bg}
        boxShadow={isSelected ? selectedLabelStyles.boxShadow : labelStyles.boxShadow}
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
