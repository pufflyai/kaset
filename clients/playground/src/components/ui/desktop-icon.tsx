import { rgbaFromHex, type AdaptiveWallpaperResult } from "@/services/desktop/hooks/useAdaptiveWallpaperSample";
import { DEFAULT_DESKTOP_APP_ICON } from "@/state/types";
import { Box, chakra } from "@chakra-ui/react";
import { AppWindowMac } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { forwardRef, type KeyboardEvent, type MouseEvent } from "react";

interface DesktopIconProps {
  icon?: IconName;
  label: string;
  isSelected?: boolean;
  tabIndex?: number;
  onSelect?: () => void;
  onOpen?: () => void;
  onFocus?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  palette: AdaptiveWallpaperResult;
}

const DesktopIconRoot = chakra.button;

export const DesktopIcon = forwardRef<HTMLButtonElement, DesktopIconProps>((props, ref) => {
  const { icon: iconName, label, isSelected, tabIndex = 0, onSelect, onOpen, onFocus, onContextMenu, palette } = props;
  const icon = iconName ?? DEFAULT_DESKTOP_APP_ICON;
  const baseAlpha = palette.overlayAlpha > 0 ? palette.overlayAlpha : 0.05;
  const hoverAlpha = clamp(baseAlpha, 0.14, 0.28);
  const iconPadBaseBackground = rgbaFromHex(palette.overlayBase, clamp(baseAlpha, 0.16, 0.32));
  const iconPadHoverBackground = rgbaFromHex(palette.overlayBase, clamp(hoverAlpha + 0.04, 0.16, 0.32));

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onSelect?.();
    onOpen?.();
  };

  return (
    <DesktopIconRoot
      ref={ref}
      className="group"
      type="button"
      display="flex"
      flexDirection="column"
      alignItems="center"
      gap="2xs"
      maxWidth="5rem"
      cursor="pointer"
      position="relative"
      color={palette.textColor}
      background="transparent"
      transition="transform 120ms ease, background 120ms ease, color 120ms ease"
      _hover={{ transform: "translateY(-2px)" }}
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
        _groupHover={{ background: iconPadHoverBackground }}
        transition="background 120ms ease, backdrop-filter 120ms ease"
        backdropFilter={"blur(8px)"}
        display="flex"
        alignItems="center"
        justifyContent="center"
        width="3rem"
        height="3rem"
        borderRadius="md"
      >
        <DynamicIcon name={icon} size={24} fallback={() => <AppWindowMac size={24} />} />
      </Box>
      <Box
        px="2xs"
        pt="1px"
        textAlign="center"
        width="fit-content"
        maxWidth="100%"
        mx="auto"
        backdropFilter={"blur(8px)"}
        color={palette.textColor}
        background={iconPadBaseBackground}
        textShadow="0 1px 2px rgb(0 0 0 / 0.25)"
        transition="background 120ms ease, color 120ms ease, filter 120ms ease"
        textStyle="label/S/medium"
        _groupHover={{ textDecoration: "underline" }}
        wordBreak="break-word"
        lineClamp={2}
      >
        {label}
      </Box>
    </DesktopIconRoot>
  );
});

DesktopIcon.displayName = "DesktopIcon";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
