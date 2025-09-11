import { DiffEditor as MonacoDiffEditor } from "@monaco-editor/react";
import { useMemo } from "react";
import { customTheme } from "./code-editor";

interface DiffEditorProps {
  original: string;
  modified: string;
  language?: string;
  sideBySide?: boolean; // default false to keep single-screen view
  disableScroll?: boolean; // hide scrollbars to keep in one screen
}

export function DiffEditor(props: DiffEditorProps) {
  const { original, modified, language = "plaintext", sideBySide = false, disableScroll = true } = props;

  const options = useMemo(() => {
    return {
      renderSideBySide: sideBySide,
      readOnly: true,
      fontSize: 11,
      wordWrap: "on" as const,
      scrollBeyondLastLine: false,
      ...(disableScroll
        ? {
            scrollbar: {
              vertical: "hidden" as const,
              horizontal: "hidden" as const,
              useShadows: false,
              alwaysConsumeMouseWheel: false,
            },
          }
        : {}),
    } as const;
  }, [sideBySide, disableScroll]);

  return (
    <MonacoDiffEditor
      width="100%"
      height="100%"
      original={original}
      modified={modified}
      language={language}
      theme="ps-theme"
      options={options}
      beforeMount={(monaco: any) => {
        monaco.editor.defineTheme("ps-theme", customTheme);
      }}
      onMount={(_: any, monaco: any) => {
        monaco.editor.setTheme("ps-theme");
      }}
    />
  );
}
