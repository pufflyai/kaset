import { Editor } from "@monaco-editor/react";
import { useFileContent } from "@pstdio/opfs-hooks";
import { writeFile } from "@pstdio/opfs-utils";
import { useEffect, useMemo, useRef, useState } from "react";

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
  filePath?: string;
  language?: string;
  defaultCode?: string;
  code?: string;
  isEditable?: boolean;
  showLineNumbers?: boolean;
  onChange?: (code: string) => void;
  disableScroll?: boolean;
  autoSave?: boolean;
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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveInProgressRef = useRef(false);

  const writeToOpfs = async (fullPath: string, content: string) => {
    const normalize = (p?: string) => (p ? p.split("/").filter(Boolean).join("/") : "");

    const id = normalize(fullPath);
    const root = normalize(rootDir);

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
      theme="ps-theme"
      options={options}
      onChange={(value) => {
        const next = value || "";
        if (usingFilePath) {
          setEditorContent(next);
          editorContentRef.current = next;
          isDirtyRef.current = true;
          if (filePath && isEditable) scheduleSave(filePath, next);
        }
        onChange?.(next);
      }}
      beforeMount={(monaco) => {
        monaco.editor.defineTheme("ps-theme", customTheme);
      }}
      onMount={async (editor, monaco) => {
        monaco.editor.setTheme("ps-theme");
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
          jsx: monaco.languages.typescript.JsxEmit.React,
        });
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
          await editor.getAction("editor.action.formatDocument")?.run();
        });
        await editor.getAction("editor.action.formatDocument")?.run();
      }}
    />
  );
};
