import {
  rgbaFromHex,
  useAdaptiveWallpaperSample,
  type AdaptiveWallpaperResult,
} from "@/hooks/useAdaptiveWallpaperSample";
import { DEFAULT_DESKTOP_APP_ICON } from "@/state/types";
import { Box, chakra } from "@chakra-ui/react";
import { AppWindowMac } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { type KeyboardEvent, type MouseEvent, useRef } from "react";

interface DesktopIconProps {
  icon?: IconName;
  label: string;
  isSelected?: boolean;
  tabIndex?: number;
  onSelect?: () => void;
  onOpen?: () => void;
  onFocus?: () => void;
  onContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Pass your wallpaper <img> or <canvas> so AdaptivePanel can sample it */
  sampleEl?: HTMLImageElement | HTMLCanvasElement | null;
  palette: AdaptiveWallpaperResult;
}

const DesktopIconRoot = chakra.button;

export const DesktopIcon = (props: DesktopIconProps) => {
  const {
    icon: iconName,
    label,
    isSelected,
    tabIndex = 0,
    onSelect,
    onOpen,
    onFocus,
    onContextMenu,
    sampleEl,
    palette,
  } = props;
  const icon = iconName ?? DEFAULT_DESKTOP_APP_ICON;
  const baseAlpha = palette.overlayAlpha > 0 ? palette.overlayAlpha : 0.18;
  const hoverAlpha = clamp(baseAlpha, 0.14, 0.28);
  const iconPadHoverBackground = rgbaFromHex(palette.overlayBase, clamp(hoverAlpha + 0.04, 0.16, 0.32));
  const labelRef = useRef<HTMLDivElement | null>(null);
  const labelPalette = useAdaptiveWallpaperSample(labelRef, sampleEl, {
    targetContrast: 4.5,
    maxAlpha: 0.6,
    fallback: palette,
    baseColor: palette.backgroundHex,
  });

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
      color={palette.textColor}
      background="transparent"
      transition="transform 120ms ease, background 120ms ease, color 120ms ease"
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
        background="transparent"
        _groupHover={{ background: iconPadHoverBackground }}
        transition="background 120ms ease"
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
        ref={labelRef}
        px="2xs"
        pt="1px"
        textAlign="center"
        width="fit-content"
        maxWidth="100%"
        mx="auto"
        color={labelPalette.textColor}
        background={labelPalette.overlayRgba}
        textShadow="0 1px 2px rgb(0 0 0 / 0.25)"
        transition="background 120ms ease, color 120ms ease, filter 120ms ease"
        backdropFilter={labelPalette.needsOverlay ? "blur(6px) saturate(120%)" : "none"}
        textStyle="label/S/medium"
        _groupHover={{ textDecoration: "underline" }}
        wordBreak="break-word"
      >
        {label}
      </Box>
    </DesktopIconRoot>
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
