import { Editor } from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFileContent } from "@pstdio/opfs-hooks";
import { getDirectoryHandle } from "@pstdio/opfs-utils";

const customTheme = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [],
  colors: {
    "editor.background": "#0a0d15",
    "editor.foreground": "#f5f5f5",
    "editor.lineHighlightBackground": "#22252C",
    "editorCursor.foreground": "#A7A7A7",
    "editorWhitespace.foreground": "#3B3B3B",
    "editorIndentGuide.background": "#404040",
    "editorIndentGuide.activeBackground": "#707070",
  },
};

interface CodeEditorProps {
  // If provided, the editor will derive language and content from OPFS
  filePath?: string;

  // Fallback/manual configuration (for non-file usage)
  language?: string;
  defaultCode?: string;
  code?: string;

  // Behavior
  isEditable?: boolean;
  showLineNumbers?: boolean;
  onChange?: (code: string) => void;
  disableScroll?: boolean;

  // When using filePath, automatically persist changes to OPFS
  autoSave?: boolean;
  // Root directory for OPFS resolution
  rootDir?: string;
}

export const CodeEditor = (props: CodeEditorProps) => {
  const {
    filePath,
    defaultCode,
    code,
    showLineNumbers,
    isEditable = false,
    language: explicitLanguage,
    onChange,
    disableScroll,
    autoSave = true,
    rootDir,
  } = props;

  const usingFilePath = Boolean(filePath);

  // Derive language from path if available, else use explicitLanguage or default
  const derivedLanguage = useMemo(() => {
    if (!filePath) return explicitLanguage ?? "javascript";

    const name = filePath.toLowerCase();
    if (name.endsWith(".tsx") || name.endsWith(".ts")) return "typescript";
    if (name.endsWith(".jsx") || name.endsWith(".js")) return "javascript";
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".md") || name.endsWith(".markdown")) return "markdown";
    if (name.endsWith(".css")) return "css";
    if (name.endsWith(".html") || name.endsWith(".htm")) return "html";
    if (name.endsWith(".yaml") || name.endsWith(".yml")) return "yaml";
    return "plaintext";
  }, [filePath, explicitLanguage]);

  // File-based content handling
  const { content: opfsContent } = useFileContent(usingFilePath ? filePath! : "");
  const [editorContent, setEditorContent] = useState<string>("");

  // Keep editor content in sync with OPFS for the current file.
  // This ensures that when switching files, we update once the new content arrives.
  useEffect(() => {
    if (!usingFilePath) return;

    if (filePath) {
      setEditorContent(opfsContent ?? "");
    } else {
      setEditorContent("");
    }
  }, [usingFilePath, filePath, opfsContent]);

  // Persist changes back to OPFS (debounced) when using filePath
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef(false);

  const writeToOpfs = async (fullPath: string, content: string) => {
    const dir = await getDirectoryHandle(rootDir);

    // Resolve path relative to rootDir if provided and prefixed, else treat as absolute
    const idParts = fullPath.split("/").filter(Boolean);
    const rootParts = (rootDir ?? "").split("/").filter(Boolean);
    const hasRootPrefix = rootDir && idParts.slice(0, rootParts.length).join("/") === rootDir;
    const relParts = hasRootPrefix ? idParts.slice(rootParts.length) : idParts;

    let currentDir: FileSystemDirectoryHandle = dir;
    for (let i = 0; i < Math.max(0, relParts.length - 1); i++) {
      currentDir = await currentDir.getDirectoryHandle(relParts[i]);
    }

    const fileName = relParts[relParts.length - 1];
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  };

  const scheduleSave = (path: string, content: string) => {
    if (!usingFilePath || !autoSave) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      if (saveInProgressRef.current) return;
      try {
        saveInProgressRef.current = true;
        await writeToOpfs(path, content);
      } finally {
        saveInProgressRef.current = false;
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const options = {
    tabSize: 2,
    minimap: {
      enabled: false,
    },
    fontSize: 12,
    readOnly: !isEditable,
    lineNumbers: showLineNumbers ? "on" : "off",
    ...(disableScroll
      ? {
          scrollbar: {
            vertical: "hidden" as const,
            horizontal: "hidden" as const,
            useShadows: false,
            alwaysConsumeMouseWheel: false,
          },
          scrollBeyondLastLine: false,
          mouseWheelScrollSensitivity: 0,
          overviewRulerLanes: 0,
        }
      : {}),
  } as const;

  return (
    <Editor
      width="100%"
      height="100%"
      language={derivedLanguage}
      defaultValue={usingFilePath ? undefined : defaultCode}
      value={usingFilePath ? editorContent : code}
      theme={"ps-theme"}
      options={options}
      onChange={(value) => {
        const next = value || "";
        if (usingFilePath) {
          setEditorContent(next);
          if (filePath && isEditable) scheduleSave(filePath, next);
        }
        onChange?.(next);
      }}
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("ps-theme", customTheme);
      }}
      onMount={async (editor, monaco) => {
        monaco.editor.setTheme("ps-theme");

        // Add JSX support
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
        });

        // Format on cmd+s
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
          await editor.getAction("editor.action.formatDocument")?.run();
        });

        // Run format on the initial value
        await editor.getAction("editor.action.formatDocument")?.run();
      }}
    />
  );
};
