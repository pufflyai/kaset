import type { SnapshotVariant } from "../compileScenarioShared";
import type { SnapshotDefinition } from "./types";
import { applyReplacements } from "./utils";

import indexTemplate from "./react-d3/files/index.tsx?raw";
import chartTemplate from "./react-d3/files/chart.tsx?raw";
import dataTemplate from "./react-d3/files/data.ts?raw";
import stylesTemplate from "./react-d3/files/styles.css?raw";

const ENTRY_PATH_TSX = "/index.tsx";

const REACT_D3_LOCKFILE = {
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@19.1.0/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
  "d3-scale": "https://esm.sh/d3-scale@4.0.2?target=es2022",
  "d3-shape": "https://esm.sh/d3-shape@3.2.0?target=es2022",
} as const;

type ReactD3VariantConfig = {
  accent: string;
  label: string;
  annotation: string;
  summary: string;
  points: Array<{
    timestamp: string;
    value: number;
  }>;
};

const REACT_D3_VARIANTS: Record<SnapshotVariant, ReactD3VariantConfig> = {
  fresh: {
    accent: "#2563eb",
    label: "Edge latency baseline",
    annotation: "First 60 seconds after cold start.",
    summary: "React + D3 snapshot ready with 7 baseline latency samples.",
    points: [
      { timestamp: "08:00", value: 246 },
      { timestamp: "08:10", value: 239 },
      { timestamp: "08:20", value: 234 },
      { timestamp: "08:30", value: 228 },
      { timestamp: "08:40", value: 222 },
      { timestamp: "08:50", value: 217 },
      { timestamp: "09:00", value: 211 },
    ],
  },
  updated: {
    accent: "#7c3aed",
    label: "Edge latency optimized",
    annotation: "Post warm cache with streaming hydration.",
    summary: "Snapshot updated with 8 optimized samples after rollout.",
    points: [
      { timestamp: "09:10", value: 208 },
      { timestamp: "09:20", value: 202 },
      { timestamp: "09:30", value: 198 },
      { timestamp: "09:40", value: 194 },
      { timestamp: "09:50", value: 189 },
      { timestamp: "10:00", value: 185 },
      { timestamp: "10:10", value: 182 },
      { timestamp: "10:20", value: 178 },
    ],
  },
} as const;

export const reactD3Snapshot: SnapshotDefinition = {
  id: "react-d3",
  label: "React + D3 widget",
  description: "Demonstrates a React latency chart that uses D3 helpers with CDN-backed dependencies.",
  lockfile: REACT_D3_LOCKFILE,
  build: (variant) => {
    const config = REACT_D3_VARIANTS[variant];

    const summaryLiteral = JSON.stringify(config.summary);
    const labelLiteral = JSON.stringify(config.label);
    const annotationLiteral = JSON.stringify(config.annotation);
    const pointsLiteral = JSON.stringify(config.points);
    const accentLiteral = JSON.stringify(config.accent);

    return {
      entry: ENTRY_PATH_TSX,
      files: {
        [ENTRY_PATH_TSX]: applyReplacements(indexTemplate, {
          __SUMMARY__: summaryLiteral,
        }),
        "/chart.tsx": chartTemplate,
        "/data.ts": applyReplacements(dataTemplate, {
          __LABEL__: labelLiteral,
          __ACCENT__: accentLiteral,
          __ANNOTATION__: annotationLiteral,
          __POINTS__: pointsLiteral,
        }),
        "/styles.css": applyReplacements(stylesTemplate, {
          __ACCENT__: config.accent,
        }),
      },
    };
  },
};
