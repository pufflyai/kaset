import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME, CompileResult, registerSources, setLockfile } from "@pstdio/tiny-ui-bundler";
import { TinyUI } from "../src/react/components/TinyUI";
import { TinyUiProvider } from "../src/react/tiny-ui-provider";
import { TinyUIStatus } from "../src/types";
import { setupTinyUI } from "../src/setupTinyUI";

import { calculateLifecycleTimings, createSnapshotInitializer, formatLifecycleTimings, now } from "./files/helpers";
import NOTEPAD_ENTRY_SOURCE from "./files/OPFS/index.tsx?raw";
import NOTEPAD_APP_SOURCE from "./files/OPFS/NotepadApp.tsx?raw";

const STORY_ROOT = "/stories/tiny-opfs";
const SOURCE_ID = "tiny-ui-opfs";

const LOCKFILE = {
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@19.1.0/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
} as const;

const ENTRY_PATH = "/index.tsx";

const SNAPSHOT_FILES: Record<string, string> = {
  "index.tsx": NOTEPAD_ENTRY_SOURCE,
  "NotepadApp.tsx": NOTEPAD_APP_SOURCE,
};

const ensureSnapshotReady = createSnapshotInitializer({
  entry: ENTRY_PATH,
  files: SNAPSHOT_FILES,
});

interface OpfsNotepadDemoProps {
  autoCompile?: boolean;
}

const OpfsNotepadDemo = ({ autoCompile = true }: OpfsNotepadDemoProps) => {
  const initializingStartedAtRef = useRef<number | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const handshakeStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [rebuildKey, setRebuildKey] = useState(0);

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

    setInitialized(false);
    setStatus("initializing");
    setMessage("Loading OPFS notepad source files into OPFS...");

    registerSources([{ id: SOURCE_ID, root: STORY_ROOT, entry: ENTRY_PATH }]);
    initializingStartedAtRef.current = now();
    compileStartedAtRef.current = null;
    handshakeStartedAtRef.current = null;
    ensureSnapshotReady(STORY_ROOT)
      .then(() => {
        if (cancelled) return;

        setInitialized(true);
        setStatus((prev) => (prev === "initializing" ? "idle" : prev));
        setMessage("OPFS notepad sources loaded. Ready to compile.");
      })
      .catch((error) => {
        if (cancelled) return;

        const normalized = error instanceof Error ? error : new Error("Failed to load OPFS notepad source files.");
        setStatus("error");
        setMessage(normalized.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStatusChange = useCallback((next: TinyUIStatus) => {
    setStatus(next);

    if (next === "initializing") {
      if (initializingStartedAtRef.current === null) {
        initializingStartedAtRef.current = now();
      }
      compileStartedAtRef.current = null;
      handshakeStartedAtRef.current = null;
      setMessage("Loading OPFS notepad source files into OPFS...");
      return;
    }

    if (next === "service-worker-ready") {
      setMessage("Tiny UI service worker ready. Preparing OPFS notepad bundle...");
      return;
    }

    if (next === "compiling") {
      if (initializingStartedAtRef.current === null) {
        initializingStartedAtRef.current = now();
      }
      compileStartedAtRef.current = now();
      handshakeStartedAtRef.current = null;
      setMessage("Compiling OPFS notepad bundle...");
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
    setMessage(`OPFS notepad bundle ready${lifecycleLabel}${cacheLabel}.`);
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
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 520 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
              height: 520,
            }}
          />
        ) : (
          <div
            aria-live="polite"
            style={{
              height: 520,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed #475569",
              color: "#475569",
            }}
          >
            Loading OPFS notepad source files...
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

const meta: Meta<typeof OpfsNotepadDemo> = {
  title: "Tiny UI/OPFS Notepad",
  component: OpfsNotepadDemo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compiles a React notepad plugin that reads and writes to the browser's Origin Private File System (OPFS).",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof OpfsNotepadDemo>;

export const Playground: Story = {
  args: {
    autoCompile: true,
  },
};
