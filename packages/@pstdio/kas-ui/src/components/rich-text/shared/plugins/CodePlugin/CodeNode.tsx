import { CodeEditor } from "../../../../code-editor.tsx";
import { Box } from "@chakra-ui/react";
import { DecoratorNode, type SerializedLexicalNode } from "lexical";
import type { ReactNode } from "react";

export interface SerializedCodeBlockNode extends SerializedLexicalNode {
  type: "codeblock";
  language: string;
  code: string;
  version: 1;
}

export class CodeBlockNode extends DecoratorNode<ReactNode> {
  __language: string;
  __code: string;

  static getType() {
    return "codeblock";
  }

  static clone(node: CodeBlockNode) {
    return new CodeBlockNode(node.__language, node.__code, node.__key);
  }

  constructor(language: string, code: string, key?: string) {
    super(key);
    this.__language = language;
    this.__code = code;
  }

  createDOM() {
    return document.createElement("div");
  }

  updateDOM() {
    return false;
  }

  static importJSON(serializedNode: SerializedCodeBlockNode): CodeBlockNode {
    const { language, code } = serializedNode;
    return new CodeBlockNode(language, code);
  }

  decorate() {
    return (
      <Box height="240px" borderRadius="md" overflow="hidden">
        <CodeEditor
          language={this.__language || "plaintext"}
          defaultCode={this.__code}
          isEditable={false}
          showLineNumbers
          disableScroll
        />
      </Box>
    );
  }
}
