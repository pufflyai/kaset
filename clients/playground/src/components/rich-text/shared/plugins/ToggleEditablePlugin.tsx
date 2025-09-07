import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

export default function ToggleEditablePlugin({ isEditable }: { isEditable: boolean }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.setEditable(isEditable);
  }, [isEditable, editor]);

  return null;
}
