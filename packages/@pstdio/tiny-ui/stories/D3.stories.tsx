import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME, CompileResult, registerSources, setLockfile } from "@pstdio/tiny-ui-bundler";
import { TinyUI } from "../src/react/components/TinyUI";
import { TinyUiProvider } from "../src/react/tiny-ui-provider";
import { setupTinyUI } from "../src/setupTinyUI";
import { TinyUIStatus } from "../src/types";

import BARS_SOURCE from "./files/D3/animations/createPulseBars.js?raw";
import SPIRAL_SOURCE from "./files/D3/animations/createSpiral.js?raw";
import GRID_SOURCE from "./files/D3/animations/createWaveGrid.js?raw";
import D3_ENTRY_SOURCE from "./files/D3/index.js?raw";
import { calculateLifecycleTimings, createSnapshotInitializer, formatLifecycleTimings, now } from "./files/helpers";

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

const ensureSnapshotReady = createSnapshotInitializer({
  entry: ENTRY_PATH,
  files: SNAPSHOT_FILES,
});

interface D3DemoProps {
  autoCompile?: boolean;
  sourceRoot?: string;
  bundleId?: string;
}

const D3Demo = ({ autoCompile = true, sourceRoot = STORY_ROOT, bundleId = SOURCE_ID }: D3DemoProps) => {
  const initializingStartedAtRef = useRef<number | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const handshakeStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>("Loading D3 source files into OPFS...");
  const [initialized, setInitialized] = useState(false);
  const [rebuildKey, setRebuildKey] = useState(0);

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, [LOCKFILE]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setupTinyUI({ serviceWorkerUrl: "/tiny-ui-sw.js" }).catch((error) => {
      console.error("[TinyUI Story] Failed to initialize Tiny UI", error);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    setInitialized(false);
    setStatus("initializing");
    setMessage("Loading D3 source files into OPFS...");

    registerSources([{ id: bundleId, root: sourceRoot, entry: ENTRY_PATH }]);
    initializingStartedAtRef.current = now();
    compileStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;

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
  }, [bundleId, sourceRoot]);

  const handleStatusChange = useCallback((next: TinyUIStatus) => {
    setStatus(next);

    if (next === "initializing") {
      if (initializingStartedAtRef.current === null) {
        initializingStartedAtRef.current = now();
      }
      compileStartedAtRef.current = null;
      handshakeStartedAtRef.current = null;
      setMessage("Loading D3 source files into OPFS...");
      return;
    }

    if (next === "service-worker-ready") {
      setMessage("Tiny UI service worker ready. Preparing D3 bundle...");
      return;
    }

    if (next === "compiling") {
      if (initializingStartedAtRef.current === null) {
        initializingStartedAtRef.current = now();
      }
      compileStartedAtRef.current = now();
      handshakeStartedAtRef.current = null;
      setMessage("Compiling D3 bundle with esbuild-wasm...");
      return;
    }

    if (next === "handshaking") {
      if (handshakeStartedAtRef.current === null) {
        handshakeStartedAtRef.current = now();
      }
      setMessage("Handshaking with the Tiny UI runtime...");
    }
  }, []);

  const handleReady = useCallback((result: CompileResult) => {
    const completedAt = now();
    const lifecycleLabel = formatLifecycleTimings(
      calculateLifecycleTimings({
        initStart: initializingStartedAtRef.current,
        compileStart: compileStartedAtRef.current,
        handshakeStart: handshakeStartedAtRef.current,
        completedAt,
      }),
    );
    compileStartedAtRef.current = null;
    initializingStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;

    const cacheLabel = result.fromCache ? " (from cache)" : "";

    setStatus("ready");
    setMessage(`D3 animations ready${lifecycleLabel}${cacheLabel}.`);
  }, []);

  const handleError = useCallback((error: Error) => {
    compileStartedAtRef.current = null;
    initializingStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;
    setStatus("error");
    setMessage(error.message);
  }, []);

  const handleRebuild = useCallback(() => {
    if (!initialized) return;
    initializingStartedAtRef.current = null;
    compileStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;
    setRebuildKey((value) => value + 1);
  }, [initialized]);

  const handleClearCache = useCallback(async () => {
    if (typeof caches === "undefined") return;

    compileStartedAtRef.current = null;
    initializingStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;

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

  const handleActionCall = useCallback(async (method: string, params?: Record<string, unknown>) => {
    console.warn("[TinyUI Story] Unhandled host request", { method, params });
    throw new Error(`Story host does not implement '${method}'`);
  }, []);

  return (
    <TinyUiProvider serviceWorkerUrl="/tiny-ui-sw.js">
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
            key={rebuildKey}
            instanceId={bundleId}
            sourceId={bundleId}
            autoCompile={autoCompile}
            skipCache={rebuildKey > 0}
            onStatusChange={handleStatusChange}
            onReady={handleReady}
            onError={handleError}
            onActionCall={handleActionCall}
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
    </TinyUiProvider>
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
