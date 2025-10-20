import { colord } from "colord";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import loadingKasetAnimation from "./loading_kaset.json";

interface LoadingKasetAnimationProps {
  autoplay?: boolean;
  className?: string;
  loop?: boolean;
  color?: string;
  speed?: number;
  style?: CSSProperties;
}

type NormalizedColor = [number, number, number, number];

const CURRENT_COLOR_MARKER = "__CURRENT_COLOR__";
const DEFAULT_NORMALIZED_COLOR: NormalizedColor = [0, 0, 0, 1];

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const normalizeColor = (value: string | null): NormalizedColor => {
  if (!value) return DEFAULT_NORMALIZED_COLOR;

  const parsed = colord(value);
  if (!parsed.isValid()) return DEFAULT_NORMALIZED_COLOR;

  const { r, g, b, a } = parsed.toRgb();
  return [r / 255, g / 255, b / 255, a];
};

const replaceColorMarkers = (node: unknown, color: NormalizedColor) => {
  if (!node) return;

  if (Array.isArray(node)) {
    node.forEach((item) => replaceColorMarkers(item, color));
    return;
  }

  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;

  if (record.k === CURRENT_COLOR_MARKER) {
    record.k = color;
    return;
  }

  for (const value of Object.values(record)) {
    replaceColorMarkers(value, color);
  }
};

// TODO: I need to fix the lottie animation

export function LoadingKasetAnimation(props: LoadingKasetAnimationProps) {
  const { autoplay = true, className, color = "currentColor", loop = true, speed = 1, style } = props;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<LottieRefCurrentProps>(null);
  const [resolvedColor, setResolvedColor] = useState<NormalizedColor | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const element = wrapperRef.current;
    if (!element) return;

    const normalized = normalizeColor(getComputedStyle(element).color);

    setResolvedColor((previous) => {
      if (!previous) return normalized;

      const isSameColor = normalized.every((value, index) => value === previous[index]);
      return isSameColor ? previous : normalized;
    });
  });

  useEffect(() => {
    if (!animationRef.current) return;

    animationRef.current.setSpeed(speed);
  }, [speed]);

  const animationData = useMemo(() => {
    if (!resolvedColor) return null;

    const cloned = JSON.parse(JSON.stringify(loadingKasetAnimation)) as typeof loadingKasetAnimation;
    replaceColorMarkers(cloned, resolvedColor);

    return cloned;
  }, [resolvedColor]);

  const wrapperStyle = useMemo(() => {
    const baseStyle: CSSProperties = { width: "100%", height: "100%" };

    if (style) {
      Object.assign(baseStyle, style);
    }

    if (color !== undefined) {
      baseStyle.color = color;
    }

    return baseStyle;
  }, [color, style]);

  if (!animationData) {
    return <div ref={wrapperRef} className={className} style={wrapperStyle} />;
  }

  return (
    <div ref={wrapperRef} className={className} style={wrapperStyle}>
      <Lottie
        animationData={animationData}
        autoplay={autoplay}
        loop={loop}
        lottieRef={animationRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
