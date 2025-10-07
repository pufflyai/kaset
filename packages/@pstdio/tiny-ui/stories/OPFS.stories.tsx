import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME } from "../src/constant.js";
import { setLockfile } from "../src/core/idb.js";
import { registerVirtualSnapshot } from "../src/core/snapshot.js";
import type { CompileResult } from "../src/esbuild/types.js";
import { TinyUI, type TinyUIHandle, type TinyUIStatus } from "../src/react/tiny-ui.js";

const STORY_ROOT = "/stories/tiny-opfs";
const SOURCE_ID = "tiny-ui-opfs";

const LOCKFILE = {
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@19.1.0/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
} as const;

const NOTEPAD_ENTRY_SOURCE = String.raw`import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { NotepadApp } from "./NotepadApp";

export function mount(container) {
  if (!container) return;

  container.innerHTML = "";

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <NotepadApp />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
`;

const NOTEPAD_APP_SOURCE = String.raw`import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const containerStyle = {
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  padding: "1.5rem",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "12px",
  width: "480px",
  maxWidth: "100%",
};

const textareaStyle = {
  minHeight: "220px",
  resize: "vertical",
  background: "#020617",
  color: "#e2e8f0",
  border: "1px solid #1f2937",
  borderRadius: "10px",
  padding: "0.75rem",
  fontSize: "1rem",
  lineHeight: "1.5",
};

const buttonRowStyle = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const buttonStyle = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  background: "#38bdf8",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButtonStyle = {
  ...buttonStyle,
  background: "#1e293b",
  color: "#e2e8f0",
};

const dangerButtonStyle = {
  ...buttonStyle,
  background: "#f97316",
  color: "#0f172a",
};

const statusStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  color: "#94a3b8",
  fontSize: "0.95rem",
};

const errorStyle = {
  color: "#f87171",
};

const folderName = "tiny-ui-notepad";
const fileName = "notes.md";

const formatTime = (value) => {
  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
};

const getStorageDirectory = async () => {
  if (typeof navigator === "undefined" || !navigator.storage) {
    throw new Error("navigator.storage is not available in this environment.");
  }

  const storage = navigator.storage;
  if (typeof storage.getDirectory !== "function") {
    throw new Error("This browser does not expose the OPFS getDirectory API.");
  }

  return storage.getDirectory();
};

const ensureFileHandle = async () => {
  const root = await getStorageDirectory();
  const folder = await root.getDirectoryHandle(folderName, { create: true });
  return folder.getFileHandle(fileName, { create: true });
};

const readFile = async (handle) => {
  const file = await handle.getFile();
  const text = await file.text();
  return { text, lastModified: file.lastModified };
};

const writeFile = async (handle, contents) => {
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
};

export function NotepadApp() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [supportsOpfs, setSupportsOpfs] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [error, setError] = useState(null);
  const fileHandleRef = useRef(null);

  const statusText = useMemo(() => {
    if (!supportsOpfs) return "OPFS is not available in this browser.";
    if (loading) return "Loading notes from OPFS...";
    if (saving) return "Saving to OPFS...";
    if (dirty) return "Unsaved changes";
    if (lastSavedAt) return "Saved " + formatTime(lastSavedAt);
    return "Ready";
  }, [supportsOpfs, loading, saving, dirty, lastSavedAt]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.getDirectory !== "function") {
        setSupportsOpfs(false);
        setLoading(false);
        return;
      }

      try {
        const handle = await ensureFileHandle();
        if (cancelled) return;

        fileHandleRef.current = handle;

        const { text, lastModified } = await readFile(handle);
        if (cancelled) return;

        setValue(text);
        if (lastModified) {
          setLastSavedAt(new Date(lastModified));
        }
      } catch (cause) {
        if (cancelled) return;

        if (cause instanceof Error) {
          if (cause.message.includes("getDirectory")) {
            setSupportsOpfs(false);
          } else {
            setError(cause.message);
          }
        } else {
          setError("Failed to access OPFS");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = useCallback((event) => {
    setValue(event.target.value);
    setDirty(true);
  }, []);

  const persistValue = useCallback(async (nextValue) => {
    const handle = fileHandleRef.current ?? (await ensureFileHandle());
    fileHandleRef.current = handle;
    await writeFile(handle, nextValue);
    setDirty(false);
    setLastSavedAt(new Date());
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || loading || !supportsOpfs) return;

    try {
      setSaving(true);
      setError(null);
      await persistValue(value);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to save to OPFS";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [loading, persistValue, saving, supportsOpfs, value]);

  const handleReload = useCallback(async () => {
    if (loading || saving) return;

    try {
      setLoading(true);
      setError(null);
      const handle = fileHandleRef.current ?? (await ensureFileHandle());
      fileHandleRef.current = handle;

      const { text, lastModified } = await readFile(handle);
      setValue(text);
      setDirty(false);
      setLastSavedAt(lastModified ? new Date(lastModified) : null);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to reload file";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [loading, saving]);

  const handleClear = useCallback(async () => {
    if (!supportsOpfs || saving) return;

    try {
      setSaving(true);
      setError(null);
      setValue("");
      await persistValue("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Failed to clear file";
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [persistValue, saving, supportsOpfs]);

  useEffect(() => {
    if (!supportsOpfs) return;

    const handleKeyDown = (event) => {
      if (event.key === "s" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleSave, supportsOpfs]);

  return (
    <div style={containerStyle}>
      <div>
        <h2 style={{ margin: 0 }}>OPFS Notepad</h2>
        <p style={{ margin: "0.25rem 0 0", color: "#94a3b8" }}>
          Type notes and persist them inside the browser's Origin Private File System.
        </p>
      </div>

      <textarea
        aria-label="Notepad contents"
        disabled={!supportsOpfs || loading}
        onChange={handleChange}
        placeholder="Start typing..."
        style={textareaStyle}
        value={value}
      />

      <div style={statusStyle}>
        <span>{statusText}</span>
        <span style={{ opacity: dirty ? 1 : 0.85 }}>
          File path: /{folderName}/{fileName}
        </span>
        {error ? <span style={errorStyle}>{error}</span> : null}
      </div>

      <div style={buttonRowStyle}>
        <button
          onClick={handleSave}
          style={buttonStyle}
          disabled={!supportsOpfs || loading || !dirty || saving}
          type="button"
        >
          {saving ? "Saving..." : "Save to OPFS"}
        </button>
        <button
          onClick={handleReload}
          style={secondaryButtonStyle}
          disabled={!supportsOpfs || loading || saving}
          type="button"
        >
          Reload
        </button>
        <button
          onClick={handleClear}
          style={dangerButtonStyle}
          disabled={!supportsOpfs || saving || (!dirty && value === "")}
          type="button"
        >
          Clear File
        </button>
      </div>

      {!supportsOpfs ? (
        <div style={errorStyle}>
          Your browser does not expose the OPFS APIs required for this demo.
        </div>
      ) : null}
    </div>
  );
}
`;

const SHARED_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      jsx: "react-jsx",
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowSyntheticDefaultImports: true,
    },
  },
  null,
  2,
);

registerVirtualSnapshot(STORY_ROOT, {
  entry: "/index.tsx",
  tsconfig: SHARED_TSCONFIG,
  files: {
    "/index.tsx": NOTEPAD_ENTRY_SOURCE,
    "/NotepadApp.tsx": NOTEPAD_APP_SOURCE,
  },
});

interface OpfsNotepadDemoProps {
  autoCompile?: boolean;
}

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const OpfsNotepadDemo = ({ autoCompile = true }: OpfsNotepadDemoProps) => {
  const uiRef = useRef<TinyUIHandle | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, []);

  const handleStatusChange = useCallback((next: TinyUIStatus) => {
    setStatus(next);
    if (next === "compiling") {
      compileStartedAtRef.current = now();
      setMessage("Compiling React notepad bundle...");
    }
  }, []);

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
    if (!uiRef.current) return;

    uiRef.current.rebuild().catch((error) => {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 520 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={status === "compiling"} onClick={handleRebuild} type="button">
          {status === "compiling" ? "Compiling..." : "Rebuild"}
        </button>
        <button onClick={handleClearCache} type="button">
          Clear Cache
        </button>
      </div>
      <TinyUI
        ref={uiRef}
        src={STORY_ROOT}
        id={SOURCE_ID}
        autoCompile={autoCompile}
        onStatusChange={handleStatusChange}
        onReady={handleReady}
        onError={handleError}
        showStatus={false}
        style={{
          width: "100%",
          minHeight: 420,
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
