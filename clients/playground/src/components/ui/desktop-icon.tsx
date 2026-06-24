import { Box, chakra } from "@chakra-ui/react";
import { AppWindowMac } from "lucide-react";
import { DynamicIcon, type IconName } from "lucide-react/dynamic";
import { forwardRef, type ComponentPropsWithoutRef, type KeyboardEvent, type MouseEvent } from "react";
import { type AdaptiveWallpaperResult, rgbaFromHex } from "@/services/desktop/hooks/useAdaptiveWallpaperSample";
import { DEFAULT_DESKTOP_APP_ICON } from "@/state/types";

interface DesktopIconProps extends Omit<ComponentPropsWithoutRef<"button">, "color" | "onSelect"> {
  icon?: IconName;
  label: string;
  isSelected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  palette: AdaptiveWallpaperResult;
}

const DesktopIconRoot = chakra.button;

export const DesktopIcon = forwardRef<HTMLButtonElement, DesktopIconProps>((props, ref) => {
  const {
    icon: iconName,
    label,
    isSelected,
    tabIndex = 0,
    onSelect,
    onOpen,
    onClick,
    onKeyDown,
    onContextMenu,
    onFocus,
    className,
    palette,
    ...rootProps
  } = props;
  const icon = iconName ?? DEFAULT_DESKTOP_APP_ICON;
  const rootClassName = ["group", className].filter(Boolean).join(" ");
  const baseAlpha = palette.overlayAlpha > 0 ? palette.overlayAlpha : 0.05;
  const hoverAlpha = clamp(baseAlpha, 0.14, 0.28);
  const iconPadBaseBackground = rgbaFromHex(palette.overlayBase, clamp(baseAlpha, 0.16, 0.32));
  const iconPadHoverBackground = rgbaFromHex(palette.overlayBase, clamp(hoverAlpha + 0.04, 0.16, 0.32));

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    event.preventDefault();
    onSelect?.();
    onOpen?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;

    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onSelect?.();
    onOpen?.();
  };

  return (
    <DesktopIconRoot
      {...rootProps}
      ref={ref}
      className={rootClassName}
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
      onClick={handleClick}
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
