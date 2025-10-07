import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OpfsWritableFileStream = {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
};

type OpfsFileHandle = {
  getFile: () => Promise<File>;
  createWritable: () => Promise<OpfsWritableFileStream>;
};

type OpfsDirectoryHandle = {
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<OpfsDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<OpfsFileHandle>;
};

type StorageWithDirectory = StorageManager & {
  getDirectory?: () => Promise<OpfsDirectoryHandle>;
};

const containerStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
  padding: "1.5rem",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "12px",
  maxWidth: "100%",
};

const textareaStyle: CSSProperties = {
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

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  flexWrap: "wrap",
};

const buttonStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  background: "#38bdf8",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 600,
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#1e293b",
  color: "#e2e8f0",
};

const dangerButtonStyle: CSSProperties = {
  ...buttonStyle,
  background: "#f97316",
  color: "#0f172a",
};

const statusStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  color: "#94a3b8",
  fontSize: "0.95rem",
};

const errorStyle: CSSProperties = {
  color: "#f87171",
};

const folderName = "tiny-ui-notepad";
const fileName = "notes.md";

const formatTime = (value: Date) =>
  new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);

const getStorageDirectory = async (): Promise<OpfsDirectoryHandle> => {
  if (typeof navigator === "undefined" || !navigator.storage) {
    throw new Error("navigator.storage is not available in this environment.");
  }

  const storage = navigator.storage as StorageWithDirectory;
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

const readFile = async (handle: OpfsFileHandle) => {
  const file = await handle.getFile();
  const text = await file.text();
  return { text, lastModified: file.lastModified };
};

const writeFile = async (handle: OpfsFileHandle, contents: string) => {
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
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileHandleRef = useRef<OpfsFileHandle | null>(null);

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
      if (
        typeof navigator === "undefined" ||
        !navigator.storage ||
        typeof (navigator.storage as StorageWithDirectory).getDirectory !== "function"
      ) {
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

  const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
    setDirty(true);
  }, []);

  const persistValue = useCallback(async (nextValue: string) => {
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

    const handleKeyDown = (event: KeyboardEvent) => {
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
