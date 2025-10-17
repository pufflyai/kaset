import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME, CompileResult, registerSources, setLockfile } from "@pstdio/tiny-ui-bundler";
import { TinyUI } from "../src/react/tiny-ui";
import { TinyUIStatus } from "../src/types";
import { setupTinyUI } from "../src/setupTinyUI";

import { calculateLifecycleTimings, createSnapshotInitializer, formatLifecycleTimings, now } from "./files/helpers";
import REACT_ENTRY_SOURCE from "./files/React/index.tsx?raw";
import COUNTER_CARD_SOURCE from "./files/React/CounterCard.tsx?raw";
import ZUSTAND_ENTRY_SOURCE from "./files/React/zustand/index.tsx?raw";
import ZUSTAND_APP_SOURCE from "./files/React/zustand/TodoApp.tsx?raw";
import ZUSTAND_INPUT_SOURCE from "./files/React/zustand/TodoInput.tsx?raw";
import ZUSTAND_LIST_SOURCE from "./files/React/zustand/TodoList.tsx?raw";
import ZUSTAND_STATS_SOURCE from "./files/React/zustand/TodoStats.tsx?raw";
import ZUSTAND_STORE_SOURCE from "./files/React/zustand/store/useTodoStore.ts?raw";

const STORY_ROOT = "/stories/tiny-react";
const SOURCE_ID = "tiny-ui-react";
const ZUSTAND_STORY_ROOT = "/stories/tiny-react-zustand";
const ZUSTAND_SOURCE_ID = "tiny-ui-react-zustand";

const LOCKFILE = {
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@19.1.0/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
  zustand: "https://esm.sh/zustand@5.0.0/es2022/zustand.mjs",
  "zustand/vanilla": "https://esm.sh/zustand@5.0.0/es2022/vanilla.mjs",
} as const;

const ENTRY_PATH = "/index.tsx";

interface SnapshotDefinition {
  entry: string;
  files: Record<string, string>;
  label: string;
}

const SNAPSHOT_DEFINITIONS: Record<string, SnapshotDefinition> = {
  [STORY_ROOT]: {
    entry: ENTRY_PATH,
    label: "React counter demo",
    files: {
      "index.tsx": REACT_ENTRY_SOURCE,
      "CounterCard.tsx": COUNTER_CARD_SOURCE,
    },
  },
  [ZUSTAND_STORY_ROOT]: {
    entry: ENTRY_PATH,
    label: "Zustand todo demo",
    files: {
      "index.tsx": ZUSTAND_ENTRY_SOURCE,
      "TodoApp.tsx": ZUSTAND_APP_SOURCE,
      "TodoInput.tsx": ZUSTAND_INPUT_SOURCE,
      "TodoList.tsx": ZUSTAND_LIST_SOURCE,
      "TodoStats.tsx": ZUSTAND_STATS_SOURCE,
      "store/useTodoStore.ts": ZUSTAND_STORE_SOURCE,
    },
  },
};

const getSnapshotDefinition = (root: string) => {
  const definition = SNAPSHOT_DEFINITIONS[root];
  if (!definition) throw new Error(`Unknown snapshot root: ${root}`);
  return definition;
};

const ensureSnapshotReady = createSnapshotInitializer({
  entry: (root) => getSnapshotDefinition(root).entry,
  files: (root) => getSnapshotDefinition(root).files,
});

interface ReactDemoProps {
  autoCompile?: boolean;
  sourceRoot?: string;
  bundleId?: string;
}

const ReactDemo = ({ autoCompile = true, sourceRoot = STORY_ROOT, bundleId = SOURCE_ID }: ReactDemoProps) => {
  const initializingStartedAtRef = useRef<number | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const handshakeStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [rebuildKey, setRebuildKey] = useState(0);

  const snapshot = SNAPSHOT_DEFINITIONS[sourceRoot];
  const label = snapshot?.label ?? "Tiny UI workspace";

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setupTinyUI({ serviceWorkerUrl: "/tiny-ui-sw.js" }).catch((error) => {
      console.error("[TinyUI Story] Failed to initialize Tiny UI", error);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const definition = SNAPSHOT_DEFINITIONS[sourceRoot];
    if (!definition) {
      setInitialized(false);
      setStatus("error");
      setMessage(`Unknown Tiny UI snapshot root: ${sourceRoot}`);
      return () => {
        cancelled = true;
      };
    }

    registerSources([{ id: bundleId, root: sourceRoot, entry: definition.entry }]);
    initializingStartedAtRef.current = now();
    compileStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;
    setInitialized(false);
    setStatus("initializing");
    setMessage(`Loading ${definition.label} source files into OPFS...`);

    ensureSnapshotReady(sourceRoot)
      .then(() => {
        if (cancelled) return;
        setInitialized(true);
        setStatus((prev) => (prev === "initializing" ? "idle" : prev));
        setMessage(`${definition.label} sources loaded. Ready to compile.`);
      })
      .catch((error) => {
        if (cancelled) return;
        const normalized = error instanceof Error ? error : new Error("Failed to load Tiny UI source files.");
        setStatus("error");
        setMessage(normalized.message);
      });

    return () => {
      cancelled = true;
    };
  }, [bundleId, sourceRoot]);

  const handleStatusChange = useCallback(
    (next: TinyUIStatus) => {
      setStatus(next);

      if (next === "initializing") {
        if (initializingStartedAtRef.current === null) {
          initializingStartedAtRef.current = now();
        }
        compileStartedAtRef.current = null;
        handshakeStartedAtRef.current = null;
        setMessage(`Loading ${label} source files into OPFS...`);
        return;
      }

      if (next === "service-worker-ready") {
        setMessage(`Tiny UI service worker ready. Preparing ${label} bundle...`);
        return;
      }

      if (next === "compiling") {
        if (initializingStartedAtRef.current === null) {
          initializingStartedAtRef.current = now();
        }
        compileStartedAtRef.current = now();
        handshakeStartedAtRef.current = null;
        setMessage(`Compiling ${label} bundle with esbuild-wasm...`);
        return;
      }

      if (next === "handshaking") {
        if (handshakeStartedAtRef.current === null) {
          handshakeStartedAtRef.current = now();
        }
        setMessage("Handshaking with the Tiny UI runtime...");
      }
    },
    [label],
  );

  const handleReady = useCallback(
    (result: CompileResult) => {
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
      setMessage(`${label} bundle ready${lifecycleLabel}${cacheLabel}.`);
    },
    [label],
  );

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
            height: 480,
          }}
        />
      ) : (
        <div
          aria-live="polite"
          style={{
            height: 480,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px dashed #475569",
            color: "#475569",
          }}
        >
          {status === "error" ? "Failed to prepare Tiny UI sources." : `Loading ${label} source files...`}
        </div>
      )}
      <div aria-live="polite">
        <strong>Status:</strong> {status}
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
};

const meta: Meta<typeof ReactDemo> = {
  title: "Tiny UI/React",
  component: ReactDemo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compiles the React counter demo using esbuild-wasm, publishes it to /virtual/*, and mounts it through the Tiny UI iframe runtime.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ReactDemo>;

export const Playground: Story = {
  args: {
    autoCompile: true,
  },
};

export const ZustandTodo: Story = {
  name: "Zustand Todo",
  args: {
    autoCompile: true,
    sourceRoot: ZUSTAND_STORY_ROOT,
    bundleId: ZUSTAND_SOURCE_ID,
  },
  parameters: {
    docs: {
      description: {
        story: "Compiles a multi-file React workspace that shares state through a Zustand store.",
      },
    },
  },
};
