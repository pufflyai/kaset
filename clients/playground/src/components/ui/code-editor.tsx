import { Editor } from "@monaco-editor/react";
import { useFileContent } from "@pstdio/opfs-hooks";
import { writeFile } from "@pstdio/opfs-utils";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

export const customTheme = {
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

  const isMobile = useIsMobile();
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
  const editorContentRef = useRef("");
  const lastFilePathRef = useRef<string | undefined>(undefined);
  const lastSyncedContentRef = useRef<string>("");
  const isDirtyRef = useRef(false);
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null);

  useEffect(() => {
    editorContentRef.current = editorContent;
  }, [editorContent]);

  // Keep editor content in sync with OPFS for the current file.
  // This ensures that when switching files, we update once the new content arrives.
  useEffect(() => {
    if (!usingFilePath) {
      lastFilePathRef.current = undefined;
      lastSyncedContentRef.current = "";
      isDirtyRef.current = false;
      return;
    }

    const nextContent = opfsContent ?? "";

    if (!filePath) {
      lastFilePathRef.current = undefined;
      lastSyncedContentRef.current = "";
      isDirtyRef.current = false;
      setEditorContent("");
      return;
    }

    const fileChanged = lastFilePathRef.current !== filePath;

    if (fileChanged) {
      lastFilePathRef.current = filePath;
      lastSyncedContentRef.current = nextContent;
      isDirtyRef.current = false;
      setEditorContent(nextContent);
      return;
    }

    if (!isDirtyRef.current && nextContent !== lastSyncedContentRef.current) {
      lastSyncedContentRef.current = nextContent;
      setEditorContent(nextContent);
      editorContentRef.current = nextContent;
    }
  }, [usingFilePath, filePath, opfsContent]);

  // Persist changes back to OPFS (debounced) when using filePath
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef(false);

  const writeToOpfs = async (fullPath: string, content: string) => {
    // Normalize helper: collapse multiple slashes and remove leading/trailing
    const normalize = (p?: string) => (p ? p.split("/").filter(Boolean).join("/") : "");

    const id = normalize(fullPath);
    const root = normalize(rootDir);

    // If filePath already includes the root prefix, use as-is; otherwise join under root
    const hasRootPrefix = root && (id === root || id.startsWith(root + "/"));
    const target = hasRootPrefix ? id : root ? `${root}/${id}` : id;

    await writeFile(`/${target}`, content);
  };

  const scheduleSave = (path: string, content: string) => {
    if (!usingFilePath || !autoSave) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const runSave = async (targetPath: string, value: string) => {
      saveInProgressRef.current = true;
      try {
        await writeToOpfs(targetPath, value);
        if (filePath === targetPath && editorContentRef.current === value) {
          isDirtyRef.current = false;
          lastSyncedContentRef.current = value;
        }
      } finally {
        saveInProgressRef.current = false;
        if (pendingSaveRef.current) {
          const next = pendingSaveRef.current;
          pendingSaveRef.current = null;
          runSave(next.path, next.content);
        }
      }
    };

    saveTimerRef.current = setTimeout(() => {
      if (saveInProgressRef.current) {
        pendingSaveRef.current = { path, content };
        return;
      }

      runSave(path, content);
    }, 500);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const effectiveEditable = isEditable && !isMobile;
  const options = {
    tabSize: 2,
    minimap: {
      enabled: false,
    },
    fontSize: isMobile ? 14 : 12,
    readOnly: !effectiveEditable,
    lineNumbers: showLineNumbers && !isMobile ? "on" : "off",
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
          editorContentRef.current = next;
          isDirtyRef.current = true;
          if (filePath && effectiveEditable) scheduleSave(filePath, next);
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
        if (effectiveEditable) {
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
            await editor.getAction("editor.action.formatDocument")?.run();
          });

          // Run format on the initial value
          await editor.getAction("editor.action.formatDocument")?.run();
        }
      }}
    />
  );
};
