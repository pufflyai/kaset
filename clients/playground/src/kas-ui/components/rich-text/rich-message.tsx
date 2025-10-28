import "./rich-text-theme.css";

import { Flex } from "@chakra-ui/react";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HorizontalRulePlugin } from "@lexical/react/LexicalHorizontalRulePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { ContentEditable } from "./shared/components/content-editable";
import { ImportCodeBlocksPlugin } from "./shared/plugins/CodePlugin/CodeBlockPlugin";
import { CodeBlockNode } from "./shared/plugins/CodePlugin/CodeNode";
import { HRNode } from "./shared/plugins/HorizontalRulePlugin/HorizontalRuleNode";
import StateUpdatePlugin from "./shared/plugins/StateUpdatePlugin";
import { TreeViewPlugin } from "./shared/plugins/TreeViewPlugin/TreeViewPlugin";
import { TRANSFORMERS_EXTENDED } from "./shared/transformers/markdown-transformers";
import theme from "./rich-text-theme";

interface EditorProps {
  debug?: boolean;
  defaultState: string;
}

const transformers = [...TRANSFORMERS, ...TRANSFORMERS_EXTENDED];

export function RichMessage(props: EditorProps) {
  const { debug = false, defaultState = "" } = props;

  const initialConfig = {
    namespace: "RICH_MESSAGE",
    nodes: [QuoteNode, LinkNode, HeadingNode, ListNode, ListItemNode, CodeNode, CodeBlockNode, HRNode],
    editorState: () => {
      return $convertFromMarkdownString(defaultState, transformers, undefined, false);
    },
    onError: (error: Error) => console.error(error),
    editable: false,
    theme,
  };

  return (
    <Flex
      className="rich-text"
      justifyContent="space-between"
      width="100%"
      maxWidth="100%"
      height="100%"
      position="relative"
      direction="column"
      overflow="hidden"
    >
      <LexicalComposer initialConfig={initialConfig}>
        <StateUpdatePlugin
          value={defaultState}
          onUpdate={(value: string) => {
            $convertFromMarkdownString(value, transformers, undefined, false);
          }}
        />
        <LinkPlugin />
        <ListPlugin />
        <HorizontalRulePlugin />
        <ImportCodeBlocksPlugin />
        <RichTextPlugin contentEditable={<ContentEditable fullWidth={false} />} ErrorBoundary={LexicalErrorBoundary} />
        {debug && <TreeViewPlugin />}
      </LexicalComposer>
    </Flex>
  );
}
