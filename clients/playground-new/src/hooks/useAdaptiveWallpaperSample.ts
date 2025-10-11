import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { FastAverageColor } from "fast-average-color";
import { colord } from "colord";

export type SampleSource = HTMLImageElement | HTMLCanvasElement | null | undefined;

export type AdaptiveWallpaperResult = {
  textColor: string;
  overlayRgba: string;
  overlayAlpha: number;
  overlayBase: "#000" | "#fff";
  needsOverlay: boolean;
  backgroundHex: string;
  bestContrast: number;
  isFallback: boolean;
};

export type AdaptiveWallpaperOptions = {
  targetContrast?: number;
  maxAlpha?: number;
  fallback?: AdaptiveWallpaperResult;
  baseColor?: string | null;
};

const DEFAULT_RESULT: AdaptiveWallpaperResult = {
  textColor: "#fff",
  overlayRgba: "rgba(0, 0, 0, 0.35)",
  overlayAlpha: 0.35,
  overlayBase: "#000",
  needsOverlay: true,
  backgroundHex: "#000000",
  bestContrast: contrast("#000000", "#fff"),
  isFallback: true,
};

export function useAdaptiveWallpaperSample<TElement extends HTMLElement>(
  targetRef: RefObject<TElement | null>,
  sampleEl: SampleSource,
  options?: AdaptiveWallpaperOptions,
) {
  const { targetContrast = 4.5, maxAlpha = 0.6, fallback = DEFAULT_RESULT, baseColor } = options ?? {};

  const fallbackResult = useMemo(
    () => (baseColor ? buildAdaptiveResultFromColor(baseColor, targetContrast, maxAlpha, fallback) : fallback),
    [baseColor, targetContrast, maxAlpha, fallback],
  );

  const [result, setResult] = useState<AdaptiveWallpaperResult>(fallbackResult);
  const facRef = useRef<FastAverageColor | null>(null);

  if (!facRef.current) {
    facRef.current = new FastAverageColor();
  }

  useEffect(() => {
    return () => {
      facRef.current?.destroy();
      facRef.current = null;
    };
  }, []);

  useEffect(() => {
    const element = targetRef.current;
    if (!element) {
      setResult(fallbackResult);
      return;
    }

    const fac = facRef.current;
    if (!fac) return;

    let raf = 0;

    const measureAndCompute = () => {
      if (!sampleEl) {
        setResult(fallbackResult);
        return;
      }

      try {
        const panelBox = element.getBoundingClientRect();
        const sampleBox = sampleEl.getBoundingClientRect();

        if (panelBox.width === 0 || panelBox.height === 0 || sampleBox.width === 0 || sampleBox.height === 0) {
          return;
        }

        const intrinsicWidth = "naturalWidth" in sampleEl ? sampleEl.naturalWidth : sampleEl.width;
        const intrinsicHeight = "naturalHeight" in sampleEl ? sampleEl.naturalHeight : sampleEl.height;

        if (intrinsicWidth === 0 || intrinsicHeight === 0) {
          return;
        }

        const scaleX = intrinsicWidth / sampleBox.width;
        const scaleY = intrinsicHeight / sampleBox.height;

        const left = Math.max(0, (panelBox.left - sampleBox.left) * scaleX);
        const top = Math.max(0, (panelBox.top - sampleBox.top) * scaleY);
        const width = Math.max(1, panelBox.width * scaleX);
        const height = Math.max(1, panelBox.height * scaleY);

        const { hex: backgroundHex } = fac.getColor(sampleEl, {
          left,
          top,
          width,
          height,
          algorithm: "sqrt",
        });

        const contrastWithBlack = contrast(backgroundHex, "#000");
        const contrastWithWhite = contrast(backgroundHex, "#fff");
        const textColor = contrastWithBlack >= contrastWithWhite ? "#000" : "#fff";
        const bestContrast = Math.max(contrastWithBlack, contrastWithWhite);

        if (bestContrast >= targetContrast) {
          setResult({
            textColor,
            overlayRgba: "transparent",
            overlayAlpha: 0,
            overlayBase: textColor === "#fff" ? "#000" : "#fff",
            needsOverlay: false,
            backgroundHex,
            bestContrast,
            isFallback: false,
          });
          return;
        }

        const overlayBase = textColor === "#fff" ? "#000" : "#fff";
        const overlayAlpha = smallestAlphaForContrast(backgroundHex, overlayBase, textColor, targetContrast, maxAlpha);
        const overlayRgba = rgbaFromHex(overlayBase, overlayAlpha);

        setResult({
          textColor,
          overlayRgba,
          overlayAlpha,
          overlayBase,
          needsOverlay: overlayAlpha > 0,
          backgroundHex,
          bestContrast,
          isFallback: false,
        });
      } catch {
        setResult(fallbackResult);
      }
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measureAndCompute);
    };

    const elementObserver = new ResizeObserver(scheduleMeasure);
    elementObserver.observe(element);

    window.addEventListener("resize", scheduleMeasure);

    let sampleObserver: ResizeObserver | null = null;
    let loadHandler: (() => void) | null = null;

    if (sampleEl) {
      sampleObserver = new ResizeObserver(scheduleMeasure);
      sampleObserver.observe(sampleEl);

      if ("complete" in sampleEl) {
        loadHandler = () => scheduleMeasure();
        sampleEl.addEventListener("load", loadHandler);
      }
    }

    raf = requestAnimationFrame(measureAndCompute);

    return () => {
      elementObserver.disconnect();
      sampleObserver?.disconnect();

      if (loadHandler && sampleEl) {
        sampleEl.removeEventListener("load", loadHandler);
      }

      window.removeEventListener("resize", scheduleMeasure);
      cancelAnimationFrame(raf);
    };
  }, [targetRef, sampleEl, targetContrast, maxAlpha, fallbackResult]);

  useEffect(() => {
    if (!sampleEl) {
      setResult(fallbackResult);
    }
  }, [sampleEl, fallbackResult]);

  return result;
}

export function rgbaFromHex(hex: string, alpha: number) {
  const { r, g, b } = colord(hex).toRgb();
  return `rgba(${r}, ${g}, ${b}, ${roundToHundredth(alpha)})`;
}

export function contrast(bgHex: string, fgHex: string) {
  const luminance = (hex: string) => {
    const { r, g, b } = colord(hex).toRgb();

    const channel = (value: number) => {
      const scaled = value / 255;
      return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
    };

    const rLin = channel(r);
    const gLin = channel(g);
    const bLin = channel(b);

    return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
  };

  const L1 = luminance(fgHex);
  const L2 = luminance(bgHex);
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];

  return (hi + 0.05) / (lo + 0.05);
}

export function buildAdaptiveResultFromColor(
  colorInput: string,
  targetContrast: number,
  maxAlpha: number,
  fallback: AdaptiveWallpaperResult,
): AdaptiveWallpaperResult {
  const parsed = colord(colorInput);
  if (!parsed.isValid()) {
    return fallback;
  }

  const backgroundHex = parsed.toHex();
  const contrastWithBlack = contrast(backgroundHex, "#000");
  const contrastWithWhite = contrast(backgroundHex, "#fff");
  const textColor = contrastWithBlack >= contrastWithWhite ? "#000" : "#fff";
  const bestContrast = Math.max(contrastWithBlack, contrastWithWhite);

  if (bestContrast >= targetContrast) {
    return {
      textColor,
      overlayRgba: "transparent",
      overlayAlpha: 0,
      overlayBase: textColor === "#fff" ? "#000" : "#fff",
      needsOverlay: false,
      backgroundHex,
      bestContrast,
      isFallback: false,
    };
  }

  const overlayBase = textColor === "#fff" ? "#000" : "#fff";
  const overlayAlpha = smallestAlphaForContrast(backgroundHex, overlayBase, textColor, targetContrast, maxAlpha);
  const overlayRgba = rgbaFromHex(overlayBase, overlayAlpha);

  return {
    textColor,
    overlayRgba,
    overlayAlpha,
    overlayBase,
    needsOverlay: overlayAlpha > 0,
    backgroundHex,
    bestContrast,
    isFallback: false,
  };
}

function blendOver(bgHex: string, overlayHex: string, alpha: number) {
  const background = colord(bgHex).toRgb();
  const overlay = colord(overlayHex).toRgb();

  const blend = (base: number, over: number) => Math.round((1 - alpha) * base + alpha * over);

  return colord({
    r: blend(background.r, overlay.r),
    g: blend(background.g, overlay.g),
    b: blend(background.b, overlay.b),
  }).toHex();
}

function smallestAlphaForContrast(bgHex: string, overlayBase: string, text: string, target: number, maxAlpha: number) {
  if (maxAlpha <= 0) return 0;

  const canReachTarget = contrast(blendOver(bgHex, overlayBase, maxAlpha), text) >= target;

  if (!canReachTarget) {
    return roundToHundredth(maxAlpha);
  }

  let low = 0;
  let high = maxAlpha;
  let best = maxAlpha;

  for (let i = 0; i < 18; i += 1) {
    const mid = (low + high) / 2;
    const currentContrast = contrast(blendOver(bgHex, overlayBase, mid), text);

    if (currentContrast >= target) {
      best = mid;
      high = mid;
    } else {
      low = mid;
    }
  }

  return roundToHundredth(best);
}

const roundToHundredth = (value: number) => Math.round(value * 100) / 100;

export const defaultAdaptiveResult = DEFAULT_RESULT;
