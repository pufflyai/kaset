import { getSpecificMimeType, readFile } from "@pstdio/opfs-utils";
import { FastAverageColor } from "fast-average-color";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAdaptiveResultFromColor,
  defaultAdaptiveResult,
  type AdaptiveWallpaperResult,
} from "./useAdaptiveWallpaperSample";

interface UseDesktopWallpaperResult {
  backgroundImageUrl: string | null;
  handleWallpaperRef: (node: HTMLImageElement | null) => void;
  iconPalette: AdaptiveWallpaperResult;
}

const isNotFoundError = (error: unknown) => {
  if (!error) return false;
  const info = error as { name?: string; code?: string | number };
  return info?.name === "NotFoundError" || info?.code === "ENOENT" || info?.code === 1;
};

export const useDesktopWallpaper = (wallpaper: string | null): UseDesktopWallpaperResult => {
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(null);
  const [wallpaperElement, setWallpaperElement] = useState<HTMLImageElement | null>(null);
  const [averageColor, setAverageColor] = useState<string | null>(null);
  const averageColorFacRef = useRef<FastAverageColor | null>(null);

  useEffect(() => {
    return () => {
      averageColorFacRef.current?.destroy();
      averageColorFacRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!wallpaperElement || !backgroundImageUrl) {
      setAverageColor(null);
      return;
    }

    if (!averageColorFacRef.current && typeof window !== "undefined") {
      averageColorFacRef.current = new FastAverageColor();
    }

    const fac = averageColorFacRef.current;
    if (!fac) {
      setAverageColor(null);
      return;
    }

    let cancelled = false;

    const computeAverage = () => {
      fac
        .getColorAsync(wallpaperElement, { algorithm: "sqrt" })
        .then((result) => {
          if (cancelled) return;

          setAverageColor((current) => (current === result.hex ? current : result.hex));
        })
        .catch(() => {
          if (!cancelled) {
            setAverageColor(null);
          }
        });
    };

    const handleLoad = () => {
      computeAverage();
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            computeAverage();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(wallpaperElement);
    }

    if ("complete" in wallpaperElement) {
      wallpaperElement.addEventListener("load", handleLoad);
    }

    computeAverage();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if ("complete" in wallpaperElement) {
        wallpaperElement.removeEventListener("load", handleLoad);
      }
    };
  }, [wallpaperElement, backgroundImageUrl]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let retryHandle: number | null = null;
    let cancelled = false;

    const disposeObjectUrl = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    const loadWallpaper = async () => {
      if (cancelled) return;

      if (!wallpaper) {
        disposeObjectUrl();
        setBackgroundImageUrl(null);
        setWallpaperElement(null);
        return;
      }

      try {
        const fileData = await readFile(wallpaper, { encoding: null });

        if (!(fileData instanceof Uint8Array)) {
          disposeObjectUrl();
          setBackgroundImageUrl(null);
          setWallpaperElement(null);
          return;
        }

        const mimeType = getSpecificMimeType(wallpaper) || "application/octet-stream";
        const blob = new Blob([fileData], { type: mimeType });
        const nextObjectUrl = URL.createObjectURL(blob);

        disposeObjectUrl();
        objectUrl = nextObjectUrl;
        setBackgroundImageUrl(nextObjectUrl);
      } catch (error) {
        if (cancelled) return;

        if (isNotFoundError(error)) {
          if (typeof window !== "undefined") {
            if (retryHandle !== null) {
              window.clearTimeout(retryHandle);
              retryHandle = null;
            }
            retryHandle = window.setTimeout(() => {
              void loadWallpaper();
            }, 500);
          }
          return;
        }

        console.error("Failed to load wallpaper:", error);
        disposeObjectUrl();
        setBackgroundImageUrl(null);
        setWallpaperElement(null);
      }
    };

    void loadWallpaper();

    return () => {
      cancelled = true;

      if (typeof window !== "undefined" && retryHandle !== null) {
        window.clearTimeout(retryHandle);
        retryHandle = null;
      }

      disposeObjectUrl();
    };
  }, [wallpaper]);

  const handleWallpaperRef = useCallback((node: HTMLImageElement | null) => {
    setWallpaperElement(node);
  }, []);

  const iconPalette = useMemo<AdaptiveWallpaperResult>(() => {
    if (!averageColor) {
      return defaultAdaptiveResult;
    }

    return buildAdaptiveResultFromColor(averageColor, 3, 0.4, defaultAdaptiveResult);
  }, [averageColor]);

  return { backgroundImageUrl, handleWallpaperRef, iconPalette };
};
