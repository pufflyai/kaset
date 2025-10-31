import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_HIGH } from "lexical";
import { useEffect } from "react";

export interface KeyboardShortcutPluginProps {
  onCtrlEnter?: () => void;
}

export function KeyboardShortcutPlugin({ onCtrlEnter }: KeyboardShortcutPluginProps) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        // Check for Ctrl+Enter or Cmd+Enter (for Mac)
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          onCtrlEnter?.();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onCtrlEnter]);

  return null;
}
