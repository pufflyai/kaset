import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME, CompileResult, registerSources, setLockfile } from "@pstdio/tiny-ui-bundler";
import { TinyUI } from "../src/react/components/TinyUI";
import { TinyUiProvider } from "../src/react/tiny-ui-provider";
import { TinyUIStatus } from "../src/types";
import { setupTinyUI } from "../src/setupTinyUI";

import { calculateLifecycleTimings, createSnapshotInitializer, formatLifecycleTimings, now } from "./files/helpers";
import VANILLA_ENTRY_SOURCE from "./files/Vanilla/index.js?raw";

const STORY_ROOT = "/stories/tiny-vanilla";
const SOURCE_ID = "tiny-ui-vanilla";
const ENTRY_PATH = "/index.js";

const ensureSnapshotReady = createSnapshotInitializer({
  entry: ENTRY_PATH,
  files: {
    "index.js": VANILLA_ENTRY_SOURCE,
  },
});

interface VanillaDemoProps {
  autoCompile?: boolean;
  failureMode?: "none" | "serviceWorker" | "runtimeMissing";
}

const VanillaDemo = ({ autoCompile = true, failureMode = "none" }: VanillaDemoProps) => {
  const initializingStartedAtRef = useRef<number | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const handshakeStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [rebuildKey, setRebuildKey] = useState(0);

  const serviceWorkerUrl = failureMode === "serviceWorker" ? "/tiny-ui-sw-missing.js" : "/tiny-ui-sw.js";
  const runtimeUrl = failureMode === "runtimeMissing" ? `${STORY_ROOT}/missing-runtime.html` : undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;

    setupTinyUI({ serviceWorkerUrl, runtimeUrl }).catch((error) => {
      console.error("[TinyUI Story] Failed to initialize Tiny UI", error);
    });
  }, [failureMode, runtimeUrl, serviceWorkerUrl]);

  const failureExplanation =
    failureMode === "serviceWorker"
      ? "Service worker registration fails because /tiny-ui-sw-missing.js does not exist."
      : failureMode === "runtimeMissing"
        ? "Runtime HTML caching fails because setupTinyUI points to a missing runtime HTML file."
        : null;

  useLayoutEffect(() => {
    setLockfile(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setInitialized(false);
    setStatus("initializing");
    setMessage("Loading vanilla sources into OPFS...");

    registerSources([{ id: SOURCE_ID, root: STORY_ROOT, entry: ENTRY_PATH }]);
    initializingStartedAtRef.current = now();
    compileStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;
    ensureSnapshotReady(STORY_ROOT)
      .then(() => {
        if (cancelled) return;
        setInitialized(true);
        setStatus("idle");
        setMessage("Vanilla sources loaded. Ready to compile.");
      })
      .catch((error) => {
        if (cancelled) return;
        const normalized = error instanceof Error ? error : new Error("Failed to load vanilla source files.");
        setStatus("error");
        setMessage(normalized.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = useCallback(
    (next: TinyUIStatus) => {
      setStatus(next);

      if (next === "initializing") {
        if (initializingStartedAtRef.current === null) {
          initializingStartedAtRef.current = now();
        }
        compileStartedAtRef.current = null;
        handshakeStartedAtRef.current = null;
        setMessage("Loading vanilla sources into OPFS...");
        return;
      }

      if (next === "service-worker-ready") {
        setMessage("Tiny UI service worker ready. Preparing compile...");
        return;
      }

      if (next === "compiling") {
        if (initializingStartedAtRef.current === null) {
          initializingStartedAtRef.current = now();
        }
        compileStartedAtRef.current = now();
        handshakeStartedAtRef.current = null;
        if (failureMode === "serviceWorker") {
          setMessage("Attempting to register Tiny UI service worker (expected to fail)...");
          return;
        }
        if (failureMode === "runtimeMissing") {
          setMessage("Caching Tiny UI runtime HTML (expected to fail)...");
          return;
        }
        setMessage("Compiling bundle with esbuild-wasm...");
        return;
      }

      if (next === "handshaking") {
        if (handshakeStartedAtRef.current === null) {
          handshakeStartedAtRef.current = now();
        }
        setMessage("Handshaking with the Tiny UI runtime...");
      }
    },
    [failureMode],
  );

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
    setMessage(`Bundle ready${lifecycleLabel}${cacheLabel}.`);
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
    <TinyUiProvider serviceWorkerUrl={serviceWorkerUrl} runtimeUrl={runtimeUrl}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 480 }}>
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
            instanceId={SOURCE_ID}
            sourceId={SOURCE_ID}
            autoCompile={autoCompile}
            skipCache={rebuildKey > 0}
            onStatusChange={handleStatusChange}
            onReady={handleReady}
            onError={handleError}
            onActionCall={handleActionCall}
            style={{
              height: 320,
            }}
          />
        ) : (
          <div
            aria-busy="true"
            style={{
              height: 320,
              border: "1px dashed #475569",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#475569",
            }}
          >
            Loading vanilla source files...
          </div>
        )}
        {failureExplanation ? (
          <div>
            <strong>Expected failure:</strong> {failureExplanation}
          </div>
        ) : null}
        <div aria-live="polite">
          <strong>Status:</strong> {status}
          {message ? <div>{message}</div> : null}
        </div>
      </div>
    </TinyUiProvider>
  );
};

const meta: Meta<typeof VanillaDemo> = {
  title: "Tiny UI/Vanilla",
  component: VanillaDemo,
  args: {
    failureMode: "none",
  },
  argTypes: {
    failureMode: {
      options: ["none", "serviceWorker", "runtimeMissing"],
      control: { type: "radio" },
      description: "Intentionally misconfigure Tiny UI to surface unhappy path behaviour.",
    },
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compiles a vanilla counter demo, caches it under /virtual/*, and mounts it through the Tiny UI iframe runtime.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof VanillaDemo>;

export const Playground: Story = {
  args: {
    autoCompile: true,
    failureMode: "none",
  },
};

export const UnhappyPath: Story = {
  name: "Unhappy Path",
  args: {
    autoCompile: true,
    failureMode: "serviceWorker",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates Tiny UI error handling. Toggle the failureMode control to see a missing service worker or runtime HTML failure.",
      },
    },
  },
};
