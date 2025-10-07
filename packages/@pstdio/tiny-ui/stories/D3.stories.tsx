import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME } from "../src/constant.js";
import { setLockfile } from "../src/core/idb.js";
import { registerVirtualSnapshot } from "../src/core/snapshot.js";
import type { CompileResult } from "../src/esbuild/types.js";
import { TinyUI, type TinyUIHandle, type TinyUIStatus } from "../src/react/tiny-ui.js";

const STORY_ROOT = "/stories/tiny-d3";
const SOURCE_ID = "tiny-ui-d3";

const LOCKFILE = {
  "d3-selection": "https://esm.sh/d3-selection@3.0.0/es2022/d3-selection.mjs",
  "d3-array": "https://esm.sh/d3-array@3.2.4/es2022/d3-array.mjs",
  "d3-timer": "https://esm.sh/d3-timer@3.0.1/es2022/d3-timer.mjs",
} as const;

const D3_ENTRY_SOURCE = String.raw`import { createSpiralAnimation } from "./animations/createSpiral";
import { createPulseBars } from "./animations/createPulseBars";
import { createWaveGrid } from "./animations/createWaveGrid";

const animations = [
  {
    name: "Aurora Spiral",
    description: "Orbiting particles swirl around a shimmering core.",
    run: createSpiralAnimation,
  },
  {
    name: "Chromatic Pulse",
    description: "Audio-inspired bars breathe with layered sine waves.",
    run: createPulseBars,
  },
  {
    name: "Wave Grid",
    description: "A field of nodes reacts to traveling ripple patterns.",
    run: createWaveGrid,
  },
];

export function mount(container) {
  if (!container) return;

  container.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = [
    ".d3-gallery {",
    "  font-family: system-ui, sans-serif;",
    "  color: #e2e8f0;",
    "  background: #020617;",
    "  border-radius: 12px;",
    "  padding: 24px;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 24px;",
    "  min-height: 320px;",
    "  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.55);",
    "}",
    ".d3-gallery__intro {",
    "  max-width: 560px;",
    "}",
    ".d3-gallery__intro h2 {",
    "  margin: 0 0 8px;",
    "  font-size: 1.5rem;",
    "  color: #38bdf8;",
    "}",
    ".d3-gallery__intro p {",
    "  margin: 0;",
    "  color: #94a3b8;",
    "  line-height: 1.4;",
    "}",
    ".d3-gallery__grid {",
    "  display: grid;",
    "  gap: 20px;",
    "  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));",
    "}",
    ".d3-card {",
    "  background: linear-gradient(160deg, rgba(15, 23, 42, 0.92), rgba(14, 165, 233, 0.35));",
    "  border: 1px solid rgba(148, 163, 184, 0.15);",
    "  border-radius: 16px;",
    "  padding: 18px;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 8px;",
    "  overflow: hidden;",
    "  position: relative;",
    "}",
    ".d3-card::after {",
    "  content: '';",
    "  position: absolute;",
    "  inset: 0;",
    "  pointer-events: none;",
    "  background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.25), transparent 55%);",
    "}",
    ".d3-card h3 {",
    "  margin: 0;",
    "  font-size: 1.1rem;",
    "}",
    ".d3-card p {",
    "  margin: 0;",
    "  color: #cbd5f5;",
    "  font-size: 0.9rem;",
    "}",
    ".d3-card__canvas {",
    "  flex: 1;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  min-height: 220px;",
    "  isolation: isolate;",
    "}",
    ".d3-card svg {",
    "  width: 100%;",
    "  height: 100%;",
    "}",
  ].join("\\n");

  const root = document.createElement("div");
  root.className = "d3-gallery";

  container.appendChild(style);
  container.appendChild(root);

  const intro = document.createElement("div");
  intro.className = "d3-gallery__intro";
  intro.innerHTML =
    "<h2>Kaset D3 Gallery</h2>" +
    "<p>Dynamic SVG animations rendered with D3, compiled once and streamed through the Tiny UI iframe runtime.</p>";
  root.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "d3-gallery__grid";
  root.appendChild(grid);

  const cleanup = [];

  animations.forEach((animation) => {
    const card = document.createElement("article");
    card.className = "d3-card";

    const heading = document.createElement("h3");
    heading.textContent = animation.name;
    card.appendChild(heading);

    const description = document.createElement("p");
    description.textContent = animation.description;
    card.appendChild(description);

    const canvas = document.createElement("div");
    canvas.className = "d3-card__canvas";
    card.appendChild(canvas);

    const stop = animation.run(canvas);
    if (typeof stop === "function") cleanup.push(stop);

    grid.appendChild(card);
  });

  return () => {
    cleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn("Failed to clean up animation", error);
      }
    });

    root.remove();
    style.remove();
  };
}
`;

const SPIRAL_SOURCE = String.raw`import { select } from "d3-selection";
import { range } from "d3-array";
import { timer } from "d3-timer";

const TAU = Math.PI * 2;

export function createSpiralAnimation(container) {
  const size = 280;
  const svg = select(container)
    .append("svg")
    .attr("viewBox", "0 0 " + size + " " + size)
    .attr("aria-label", "Spiral orbit animation");

  const g = svg.append("g").attr("transform", "translate(" + size / 2 + ", " + size / 2 + ")");

  const points = range(120).map((index) => {
    return {
      angle: (index / 120) * 6 * TAU,
      radius: 18 + index * 1.1,
    };
  });

  const circles = g
    .selectAll("circle")
    .data(points)
    .enter()
    .append("circle")
    .attr("r", 6)
    .attr("fill", "hsl(200, 80%, 65%)")
    .attr("opacity", 0.8);

  const spin = timer((elapsed) => {
    const time = elapsed / 900;
    const wobble = 22 * Math.sin(time * 0.9);

    circles
      .attr("cx", (d, index) => {
        const wave = d.radius + wobble * Math.sin(time + index * 0.06);
        return Math.cos(d.angle + time * 1.7) * wave;
      })
      .attr("cy", (d, index) => {
        const wave = d.radius + wobble * Math.cos(time + index * 0.05);
        return Math.sin(d.angle + time * 1.7) * wave;
      })
      .attr("r", (_, index) => 4.8 + Math.sin(time * 2.1 + index * 0.18) * 1.6)
      .attr("fill", (_, index) => {
        const hue = (210 + index * 3 + time * 70) % 360;
        const light = 55 + Math.sin(time + index * 0.2) * 12;
        return "hsl(" + hue + ", 85%, " + light + "%)";
      })
      .attr("opacity", (_, index) => 0.45 + Math.abs(Math.sin(time + index * 0.08)) * 0.55);

    g.attr("transform", "translate(" + size / 2 + ", " + size / 2 + ") rotate(" + time * 24 + ")");
  });

  return () => {
    spin.stop();
    svg.remove();
  };
}
`;

const BARS_SOURCE = String.raw`import { select } from "d3-selection";
import { range } from "d3-array";
import { timer } from "d3-timer";

export function createPulseBars(container) {
  const width = 320;
  const height = 220;
  const svg = select(container)
    .append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("aria-label", "Pulse bars animation");

  const margin = { top: 16, right: 16, bottom: 16, left: 16 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

  const count = 28;
  const xStep = innerWidth / count;

  const bars = g
    .selectAll("rect")
    .data(range(count))
    .enter()
    .append("rect")
    .attr("x", function (_, index) {
      return index * xStep + xStep * 0.1;
    })
    .attr("width", xStep * 0.8)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", "hsl(195, 90%, 65%)")
    .attr("opacity", 0.75)
    .attr("y", innerHeight - 32)
    .attr("height", 32);

  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", innerHeight)
    .attr("y2", innerHeight)
    .attr("stroke-width", 1.5)
    .attr("stroke", "rgba(226, 232, 240, 0.35)");

  const glow = timer((elapsed) => {
    const time = elapsed / 1000;

    bars
      .attr("y", function (_, index) {
        const wave = Math.sin(time * 2 + index * 0.32) + Math.cos(time * 1.4 + index * 0.45);
        const normalized = (wave + 2) / 4;
        const barHeight = 28 + normalized * (innerHeight - 36);
        return innerHeight - barHeight;
      })
      .attr("height", function (_, index) {
        const wave = Math.sin(time * 2 + index * 0.32) + Math.cos(time * 1.4 + index * 0.45);
        const normalized = (wave + 2) / 4;
        return 28 + normalized * (innerHeight - 36);
      })
      .attr("fill", function (_, index) {
        const hue = (188 + Math.sin(time + index * 0.18) * 40 + 360) % 360;
        const light = 55 + Math.sin(time * 1.5 + index * 0.28) * 14;
        return "hsl(" + hue + ", 85%, " + light + "%)";
      })
      .attr("opacity", function (_, index) {
        return 0.55 + Math.abs(Math.sin(time * 1.2 + index * 0.24)) * 0.45;
      });
  });

  return () => {
    glow.stop();
    svg.remove();
  };
}
`;

const GRID_SOURCE = String.raw`import { select } from "d3-selection";
import { range } from "d3-array";
import { timer } from "d3-timer";

export function createWaveGrid(container) {
  const size = 280;
  const svg = select(container)
    .append("svg")
    .attr("viewBox", "0 0 " + size + " " + size)
    .attr("aria-label", "Wave grid animation");

  const g = svg.append("g").attr("transform", "translate(" + size / 2 + ", " + size / 2 + ")");

  const rows = 11;
  const cols = 11;
  const spacing = size / Math.max(rows, cols);

  const nodes = range(rows * cols).map((index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      row,
      col,
      x: (col - (cols - 1) / 2) * spacing * 0.78,
      y: (row - (rows - 1) / 2) * spacing * 0.78,
    };
  });

  const circles = g
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", 5)
    .attr("fill", "hsl(260, 85%, 70%)")
    .attr("opacity", 0.8);

  const ripple = timer((elapsed) => {
    const time = elapsed / 850;

    circles
      .attr("cx", function (d) {
        const offset = Math.sin(time + d.row * 0.45 + d.col * 0.25) * 14;
        return d.x + offset;
      })
      .attr("cy", function (d) {
        const offset = Math.cos(time * 0.9 + d.row * 0.32 + d.col * 0.4) * 14;
        return d.y + offset;
      })
      .attr("r", function (d) {
        const scale = Math.sin(time * 1.4 + d.row * 0.4 + d.col * 0.5);
        return 3.5 + Math.abs(scale) * 6;
      })
      .attr("fill", function (d) {
        const hue = (280 + (d.row + d.col) * 8 + Math.sin(time + d.row * 0.3) * 60) % 360;
        const saturation = 75 + Math.sin(time * 0.8 + d.col * 0.4) * 18;
        const lightness = 60 + Math.cos(time + d.row * 0.5) * 10;
        return "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)";
      })
      .attr("opacity", function (d) {
        return 0.35 + Math.abs(Math.sin(time * 0.9 + (d.row + d.col) * 0.12)) * 0.65;
      });
  });

  return () => {
    ripple.stop();
    svg.remove();
  };
}
`;

registerVirtualSnapshot(STORY_ROOT, {
  entry: "/index.ts",
  tsconfig: JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
      },
    },
    null,
    2,
  ),
  files: {
    "/index.ts": D3_ENTRY_SOURCE,
    "/animations/createSpiral.ts": SPIRAL_SOURCE,
    "/animations/createPulseBars.ts": BARS_SOURCE,
    "/animations/createWaveGrid.ts": GRID_SOURCE,
  },
});

interface D3DemoProps {
  autoCompile?: boolean;
  sourceRoot?: string;
  bundleId?: string;
}

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const D3Demo = ({ autoCompile = true, sourceRoot = STORY_ROOT, bundleId = SOURCE_ID }: D3DemoProps) => {
  const uiRef = useRef<TinyUIHandle | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, [LOCKFILE]);

  const handleStatusChange = useCallback((next: TinyUIStatus) => {
    setStatus(next);
    if (next === "compiling") {
      compileStartedAtRef.current = now();
      setMessage("Compiling D3 bundle with esbuild-wasm...");
    }
  }, []);

  const handleReady = useCallback((result: CompileResult) => {
    const startedAt = compileStartedAtRef.current;
    compileStartedAtRef.current = null;

    const duration = typeof startedAt === "number" ? Math.max(0, Math.round(now() - startedAt)) : null;
    const timingLabel = duration !== null ? ` in ${duration}ms` : "";
    const cacheLabel = result.fromCache ? " (from cache)" : "";

    setMessage(`D3 animations ready${timingLabel}${cacheLabel}.`);
  }, []);

  const handleError = useCallback((error: Error) => {
    compileStartedAtRef.current = null;
    setStatus("error");
    setMessage(error.message);
  }, []);

  const handleRebuild = useCallback(() => {
    uiRef.current?.rebuild().catch((error) => {
      const normalized = error instanceof Error ? error : new Error("Failed to rebuild bundle");
      setStatus("error");
      setMessage(normalized.message);
    });
  }, []);

  const handleClearCache = useCallback(async () => {
    if (typeof caches === "undefined") return;

    compileStartedAtRef.current = null;

    try {
      setMessage("Clearing bundle cache...");
      await caches.delete(CACHE_NAME);
      setStatus("idle");
      setMessage("Cache cleared. Rebuild to compile again.");
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Failed to clear cache");
      setStatus("error");
      setMessage(normalized.message);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 480 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={status === "compiling"} onClick={handleRebuild} type="button">
          {status === "compiling" ? "Compiling..." : "Rebuild"}
        </button>
        <button onClick={handleClearCache} type="button">
          Clear Cache
        </button>
      </div>
      <TinyUI
        ref={uiRef}
        src={sourceRoot}
        id={bundleId}
        autoCompile={autoCompile}
        onStatusChange={handleStatusChange}
        onReady={handleReady}
        onError={handleError}
        showStatus={false}
        style={{
          width: "100%",
          minHeight: 360,
          background: "#020617",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          overflow: "hidden",
        }}
      />
      <div aria-live="polite">
        <strong>Status:</strong> {status}
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
};

const meta: Meta<typeof D3Demo> = {
  title: "Tiny UI/D3",
  component: D3Demo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compiles a bundle of D3 animations with esbuild-wasm, stores it under /virtual/*, and renders them via the Tiny UI iframe runtime.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof D3Demo>;

export const Playground: Story = {
  args: {
    autoCompile: true,
  },
};

export const ManualCompile: Story = {
  name: "Manual Compile",
  args: {
    autoCompile: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Disable autoCompile to compile the animations on demand, mirroring production rebuild flows.",
      },
    },
  },
};
