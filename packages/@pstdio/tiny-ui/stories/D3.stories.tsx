import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { writeFile } from "@pstdio/opfs-utils";

import { CACHE_NAME } from "../src/constant";
import { setLockfile } from "../src/core/idb";
import { loadSnapshot } from "../src/fs/loadSnapshot";
import type { CompileResult } from "../src/esbuild/types";
import { TinyUI, type TinyUIHandle } from "../src/react/tiny-ui";
import { TinyUIStatus } from "../src/react/types";

import D3_ENTRY_SOURCE from "./files/D3/index.js?raw";
import SPIRAL_SOURCE from "./files/D3/animations/createSpiral.js?raw";
import BARS_SOURCE from "./files/D3/animations/createPulseBars.js?raw";
import GRID_SOURCE from "./files/D3/animations/createWaveGrid.js?raw";

const STORY_ROOT = "/stories/tiny-d3";
const SOURCE_ID = "tiny-ui-d3";

const LOCKFILE = {
  "d3-selection": "https://esm.sh/d3-selection@3.0.0/es2022/d3-selection.mjs",
  "d3-array": "https://esm.sh/d3-array@3.2.4/es2022/d3-array.mjs",
  "d3-timer": "https://esm.sh/d3-timer@3.0.1/es2022/d3-timer.mjs",
} as const;

const ENTRY_PATH = "/index.js";

const SNAPSHOT_FILES: Record<string, string> = {
  "index.js": D3_ENTRY_SOURCE,
  "animations/createSpiral.js": SPIRAL_SOURCE,
  "animations/createPulseBars.js": BARS_SOURCE,
  "animations/createWaveGrid.js": GRID_SOURCE,
};

const INITIALIZED_SNAPSHOTS = new Map<string, Promise<void>>();

const ensureSnapshotReady = (root: string) => {
  const folder = root.replace(/^\/+/, "");
  if (!folder) throw new Error("Snapshot root cannot be empty.");

  let inFlight = INITIALIZED_SNAPSHOTS.get(folder);
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      await Promise.all(
        Object.entries(SNAPSHOT_FILES).map(([relativePath, source]) =>
          writeFile(`${folder}/${relativePath}`, source),
        ),
      );

      await loadSnapshot(folder, ENTRY_PATH);
    } catch (error) {
      INITIALIZED_SNAPSHOTS.delete(folder);
      throw error;
    }
  })();

  INITIALIZED_SNAPSHOTS.set(folder, inFlight);
  return inFlight;
};

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
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>("Loading D3 source files into OPFS...");
  const [initialized, setInitialized] = useState(false);

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, [LOCKFILE]);

  useEffect(() => {
    let cancelled = false;

    setInitialized(false);
    setStatus("initializing");
    setMessage("Loading D3 source files into OPFS...");

    ensureSnapshotReady(sourceRoot)
      .then(() => {
        if (cancelled) return;
        setInitialized(true);
        setStatus((prev) => (prev === "initializing" ? "idle" : prev));
        setMessage("D3 sources loaded. Ready to compile.");
      })
      .catch((error) => {
        if (cancelled) return;
        const normalized = error instanceof Error ? error : new Error("Failed to load D3 source files.");
        setStatus("error");
        setMessage(normalized.message);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceRoot]);

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
    if (!initialized) return;

    uiRef.current?.rebuild().catch((error) => {
      const normalized = error instanceof Error ? error : new Error("Failed to rebuild bundle");
      setStatus("error");
      setMessage(normalized.message);
    });
  }, [initialized]);

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
        <button disabled={status === "compiling" || !initialized} onClick={handleRebuild} type="button">
          {!initialized ? "Preparing..." : status === "compiling" ? "Compiling..." : "Rebuild"}
        </button>
        <button onClick={handleClearCache} type="button">
          Clear Cache
        </button>
      </div>
      {initialized ? (
        <TinyUI
          ref={uiRef}
          root={sourceRoot}
          id={bundleId}
          autoCompile={autoCompile}
          serviceWorkerUrl="/tiny-ui-sw.js"
          onStatusChange={handleStatusChange}
          onReady={handleReady}
          onError={handleError}
          style={{
            width: "100%",
            height: 360,
            borderRadius: 12,
            padding: 16,
            display: "flex",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: 360,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed #475569",
            color: "#475569",
          }}
          aria-live="polite"
        >
          Loading D3 source files...
        </div>
      )}
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
