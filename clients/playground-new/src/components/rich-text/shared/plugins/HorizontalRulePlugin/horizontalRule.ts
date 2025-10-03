import type { ElementTransformer } from "@lexical/markdown";
import type { LexicalNode } from "lexical";
import { $createHRNode, $isHRNode, HRNode } from "./HorizontalRuleNode";

export const HR: ElementTransformer = {
  dependencies: [HRNode],
  export: (node: LexicalNode) => {
    return $isHRNode(node) ? "***" : null;
  },
  regExp: /^(---|\*\*\*|___)\s?$/,
  replace: (parentNode) => {
    const line = $createHRNode();
    parentNode.replace(line);
  },
  type: "element",
};
