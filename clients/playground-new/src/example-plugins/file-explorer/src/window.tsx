import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { FileExplorer } from "./components/file-explorer";
import { CodeEditor } from "./components/code-editor";

const ROOT_DIR = "playground";

const normalizePath = (path: string | null) => {
  if (!path) return null;
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .join("/");
};

export function FileExplorerWindow() {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const headerSubtitle = useMemo(() => {
    if (!selectedPath) return "Pick a file to open in the editor";
    const normalized = normalizePath(selectedPath) as string;
    const prefix = `${ROOT_DIR}/`;
    return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
  }, [selectedPath]);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        background: "#020617",
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "240px",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #1e293b",
          background: "#0f172a",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #1e293b",
          }}
        >
          <h2
            style={{
              fontSize: "15px",
              fontWeight: 600,
              margin: 0,
              marginBottom: "4px",
            }}
          >
            Playground Files
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "12px",
              color: "#94a3b8",
            }}
          >
            {headerSubtitle}
          </p>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            padding: "8px",
            overflowY: "auto",
          }}
        >
          <FileExplorer
            rootDir={ROOT_DIR}
            selectedPath={selectedPath}
            onSelect={(path) => setSelectedPath(path)}
            defaultExpanded={[ROOT_DIR]}
          />
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {selectedPath ? (
          <div style={{ flex: 1, minHeight: 0 }}>
            <CodeEditor filePath={selectedPath} />
          </div>
        ) : (
          <div
            style={{
              margin: "auto",
              textAlign: "center",
              color: "#94a3b8",
              maxWidth: "420px",
              padding: "32px",
            }}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: 600,
                margin: 0,
                marginBottom: "8px",
              }}
            >
              Select a file to preview
            </h3>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6 }}>
              Browse the mock playground directory on the left. Pick any file to view its contents in the viewer panel.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function mount(container: Element | null) {
  if (!container) throw new Error("file-explorer mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);

  root.render(
    <StrictMode>
      <FileExplorerWindow />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}

export default FileExplorerWindow;
