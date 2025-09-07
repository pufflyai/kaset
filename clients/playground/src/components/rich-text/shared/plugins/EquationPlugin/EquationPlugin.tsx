import "./EquationPlugin.css";

import type { MultilineElementTransformer, TextMatchTransformer } from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";
import { $createEquationNode, $isEquationNode, EquationNode } from "./EquationNode.tsx";

export const EQUATION_INLINE: TextMatchTransformer = {
  dependencies: [EquationNode],
  export: (node) => {
    if ($isEquationNode(node) && node.isInline()) {
      return `\\( ${node.getEquation().trim()} \\)`;
    }
    return null;
  },
  importRegExp: /\\\((.*?)\\\)/,
  regExp: /\\\((.*?)\\\)/,
  replace: (textNode, match) => {
    const equationNode = $createEquationNode(match[1].trim(), true);
    textNode.replace(equationNode);
  },
  type: "text-match",
};

export const EQUATION_MULTILINE: MultilineElementTransformer = {
  dependencies: [EquationNode],
  regExpStart: /\\\[/,
  regExpEnd: /\\]/,
  export: (node) => {
    if ($isEquationNode(node) && !node.isInline()) {
      return `\\[ ${node.getEquation().trim()} \\]`;
    }
    return null;
  },
  replace: (rootNode, _children, _startMatch, _endMatch, linesInBetween) => {
    if (linesInBetween) {
      rootNode.append($createEquationNode(linesInBetween.join(" "), false));
      return true;
    }
    return false;
  },
  type: "multiline-element",
};

export function EquationPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // simeon: TODO add shortcut to insert equation if necessary etc.
  }, [editor]);

  return null;
}
