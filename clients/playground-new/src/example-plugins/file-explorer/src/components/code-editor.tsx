import { useMemo } from "react";
import { useFileContent } from "../hooks/fs";

interface CodeEditorProps {
  filePath?: string | null;
}

export function CodeEditor(props: CodeEditorProps) {
  const { filePath } = props;
  const { content } = useFileContent(filePath);

  const displayPath = useMemo(() => {
    if (!filePath) return "";
    return filePath.split("/").filter(Boolean).join("/");
  }, [filePath]);

  if (!filePath) {
    return (
      <div style={{ padding: "16px", color: "#94a3b8", fontSize: "14px" }}>Select a file to view its contents.</div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#64748b",
          }}
        >
          Viewing
        </span>
        <code
          style={{
            fontSize: "13px",
            padding: "4px 8px",
            borderRadius: "4px",
            background: "#1e293b",
            color: "#e2e8f0",
          }}
        >
          {displayPath}
        </code>
      </div>

      <textarea
        value={content}
        readOnly
        spellCheck={false}
        style={{
          flex: 1,
          resize: "none",
          fontFamily: "Menlo, Monaco, Consolas, monospace",
          fontSize: "13px",
          lineHeight: "1.45",
          padding: "12px",
          background: "#0f172a",
          color: "#e2e8f0",
          border: "1px solid #1e293b",
          borderRadius: "6px",
          outline: "none",
        }}
      />
    </div>
  );
}
