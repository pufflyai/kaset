import { Flex, Kbd, Text } from "@chakra-ui/react";
import { MarkNode } from "@lexical/mark";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { $getRoot } from "lexical";
import type { ReactElement } from "react";
import { useEffect, useRef } from "react";
import { ContentEditable } from "../shared/components/content-editable";
import ToggleEditablePlugin from "../shared/plugins/ToggleEditablePlugin";
import { TreeViewPlugin } from "../shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { KeyboardShortcutPlugin } from "./plugins/KeyboardShortcutPlugin";
import theme from "./theme/prompt-input-theme";
import { $getTextContent, getTextFromSerializedEditorState } from "./utils";

export interface PromptEditorProps {
  defaultState: string;
  debug?: boolean;
  isEditable?: boolean;
  placeholder?: ReactElement | ((isEditable: boolean) => ReactElement | null);
  onChange?: (text: string, state: object) => void;
  onError?: (error: Error) => void;
  onSubmit?: () => void;
}

const nodes = [MarkNode];

export const PromptEditor = (props: PromptEditorProps) => {
  const { defaultState, debug = false, isEditable = true, placeholder } = props;
  const { onChange, onError = () => {}, onSubmit } = props;

  const initialConfig = {
    namespace: "PROMPT_EDITOR",
    nodes,
    editorState: defaultState,
    editable: isEditable,
    onError,
    theme,
  };

  const previousTextRef = useRef<string>(getTextFromSerializedEditorState(defaultState));
  useEffect(() => {
    previousTextRef.current = getTextFromSerializedEditorState(defaultState);
  }, [defaultState]);

  const placeholderNode: ReactElement | ((isEditable: boolean) => ReactElement | null) = placeholder ?? (
    <Text textStyle="label/M/regular" color="text.placeholder" pointerEvents="none" position="absolute" top="0">
      Type your message here or press <Kbd color="text.placeholder">Ctrl</Kbd> +{" "}
      <Kbd color="text.placeholder">Enter</Kbd> to send.
    </Text>
  );

  return (
    <Flex direction="column" justifyContent="space-between" width="100%" position="relative">
      <LexicalComposer key={defaultState} initialConfig={initialConfig}>
        <HistoryPlugin />
        <RichTextPlugin
          contentEditable={<ContentEditable fullWidth />}
          placeholder={placeholderNode}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <OnChangePlugin
          ignoreSelectionChange
          ignoreHistoryMergeTagChange={false}
          onChange={(editorState) => {
            editorState.read(() => {
              // handle comment blocks properly
              const root = $getRoot();
              const rawText = $getTextContent(root);

              if (rawText !== previousTextRef.current) {
                previousTextRef.current = rawText;
                onChange?.(rawText, editorState.toJSON());
              }
            });
          }}
        />
        <ToggleEditablePlugin isEditable={isEditable} />
        <KeyboardShortcutPlugin onCtrlEnter={onSubmit} />
        {debug ? <TreeViewPlugin /> : ""}
      </LexicalComposer>
    </Flex>
  );
};
