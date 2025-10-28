import type { TextMatchTransformer } from "@lexical/markdown";
import { $createTextNode, TextNode } from "lexical";
import { HR } from "../plugins/HorizontalRulePlugin/horizontalRule";

export const UNDERLINE_INS_TAG: TextMatchTransformer = {
  dependencies: [TextNode],
  export: (node, _children) => {
    if (node instanceof TextNode) {
      let markdownText = node.getTextContent();

      if (node.hasFormat("bold")) {
        markdownText = `**${markdownText}**`;
      } else if (node.hasFormat("italic")) {
        markdownText = `*${markdownText}*`;
      } else if (node.hasFormat("underline")) {
        markdownText = `<ins>${markdownText}</ins>`;
      } else {
        return null;
      }

      return markdownText;
    }
    return null;
  },
  regExp: /<ins>(.*)<\/ins>/,
  importRegExp: /<ins>(.*)<\/ins>/,
  replace: (node, match) => {
    const textNode = $createTextNode(match[1]);
    textNode.toggleFormat("underline");
    node.replace(textNode);
  },
  type: "text-match",
};

export const UNDERLINE_U_TAG: TextMatchTransformer = {
  dependencies: [TextNode],
  export: (_node, _children) => {
    return null;
  },
  regExp: /<u>(.*)<\/u>/,
  importRegExp: /<u>(.*)<\/u>/,
  replace: (node, match) => {
    const textNode = $createTextNode(match[1]);
    textNode.toggleFormat("underline");
    node.replace(textNode);
  },
  type: "text-match",
};

export const TRANSFORMERS_EXTENDED = [HR, UNDERLINE_INS_TAG, UNDERLINE_U_TAG];
