import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME } from "../src/constant";
import { setLockfile } from "../src/core/idb";
import type { CompileResult } from "../src/esbuild/types";
import { TinyUI, type TinyUIHandle, type TinyUIProps } from "../src/react/tiny-ui";
import { TinyUIStatus } from "../src/react/types";

import { createSnapshotInitializer, now } from "./files/helpers";
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
  const uiRef = useRef<TinyUIHandle | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const serviceWorkerUrl = failureMode === "serviceWorker" ? "/tiny-ui-sw-missing.js" : "/tiny-ui-sw.js";
  const runtimeOverrides: Partial<TinyUIProps> =
    failureMode === "runtimeMissing"
      ? {
          runtimeUrl: `${STORY_ROOT}/missing-runtime.html`,
        }
      : {};
  const failureExplanation =
    failureMode === "serviceWorker"
      ? "Service worker registration fails because /tiny-ui-sw-missing.js does not exist."
      : failureMode === "runtimeMissing"
        ? "Runtime HTML caching fails because the runtimeUrl points to a missing HTML file."
        : null;

  useLayoutEffect(() => {
    setLockfile(null);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setInitialized(false);
    setStatus("initializing");
    setMessage("Loading vanilla sources into OPFS...");

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
      if (next === "compiling") {
        compileStartedAtRef.current = now();
        if (failureMode === "serviceWorker") {
          setMessage("Attempting to register Tiny UI service worker (expected to fail)...");
          return;
        }
        if (failureMode === "runtimeMissing") {
          setMessage("Caching Tiny UI runtime HTML (expected to fail)...");
          return;
        }
        setMessage("Compiling bundle with esbuild-wasm...");
      }
    },
    [failureMode],
  );

  const handleReady = useCallback((result: CompileResult) => {
    const startedAt = compileStartedAtRef.current;
    compileStartedAtRef.current = null;

    const duration = typeof startedAt === "number" ? Math.max(0, Math.round(now() - startedAt)) : null;
    const timingLabel = duration !== null ? ` in ${duration}ms` : "";
    const cacheLabel = result.fromCache ? " (from cache)" : "";

    setMessage(`Bundle ready${timingLabel}${cacheLabel}.`);
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
          ref={uiRef}
          root={STORY_ROOT}
          id={SOURCE_ID}
          autoCompile={autoCompile}
          serviceWorkerUrl={serviceWorkerUrl}
          {...runtimeOverrides}
          onStatusChange={handleStatusChange}
          onReady={handleReady}
          onError={handleError}
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
