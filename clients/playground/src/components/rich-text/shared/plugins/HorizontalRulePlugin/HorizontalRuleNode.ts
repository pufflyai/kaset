import {
  type EditorConfig,
  ElementNode,
  type LexicalEditor,
  type LexicalNode,
  type SerializedElementNode,
  type Spread,
} from "lexical";

export type SerializedHRNode = Spread<SerializedElementNode, SerializedElementNode>;

export class HRNode extends ElementNode {
  static getType() {
    return "hr";
  }

  static clone(node: HRNode) {
    return new HRNode(node?.__key);
  }

  static importJSON(_serializedNode: SerializedHRNode) {
    return $createHRNode();
  }

  exportJSON(): SerializedHRNode {
    return {
      ...super.exportJSON(),
    };
  }

  createDOM(_config: EditorConfig, _editor: LexicalEditor): HTMLElement {
    const element = document.createElement("hr");
    element.style = "margin: 2rem 0;";
    return element;
  }

  updateDOM(_prevNode: unknown, _dom: HTMLElement, _config: EditorConfig): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor) {
    return null;
  }
}

export function $createHRNode(): HRNode {
  return new HRNode();
}

export function $isHRNode(node: LexicalNode | null | undefined): node is HRNode {
  return node instanceof HRNode;
}
