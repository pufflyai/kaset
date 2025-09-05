import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

export default function StateUpdatePlugin({ value, onUpdate }: any) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value && editor) {
      editor.update(() => onUpdate(value), { tag: "history-merge" });
    }
  }, [value, editor]);

  return null;
}
