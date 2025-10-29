import { $getRoot, $isElementNode, ElementNode, Klass, LexicalNode, RootNode } from "lexical";

export function $getAllNodesOfType<T extends LexicalNode>(nodeType: Klass<T>) {
  const root = $getRoot();
  const nodesOfType: T[] = [];

  const traverse = (node: LexicalNode) => {
    if (node instanceof nodeType) {
      nodesOfType.push(node as T);
    }
    if (node instanceof ElementNode) {
      node.getChildren?.().forEach(traverse);
    }
  };

  traverse(root);
  return nodesOfType;
}

export const $getTextContent = (root: RootNode) => {
  let textContent = "";
  const children = root.getChildren();
  const childrenLength = children.length;
  for (let i = 0; i < childrenLength; i++) {
    const child = children[i];
    textContent += child.getTextContent();
    if ($isElementNode(child) && i !== childrenLength - 1 && !child.isInline()) {
      textContent += "\n";
    }
  }
  return textContent;
};

export const getTextFromSerializedEditorState = (state: string): string => {
  try {
    const parsed = JSON.parse(state);
    const traverse = (node: any): string => {
      let text = "";

      if (node.type === "comment") {
        return text; // ignore text inside comments
      }

      if (node.type === "reference") {
        // persist a small textual marker for references
        return `#${node.name ?? node.referenceId ?? ""}`;
      }

      if (typeof node.text === "string") {
        text += node.text;
      }

      if (Array.isArray(node.children)) {
        const children = node.children;
        const childrenLength = children.length;
        for (let i = 0; i < childrenLength; i++) {
          const child = children[i];
          if (child.type === "comment") {
            if (i !== childrenLength - 1) {
              text += "\n";
            }
            continue;
          }
          text += traverse(child);
          if (child.type === "paragraph" && child.children?.length) {
            text += "\n";
          }
        }
      }

      return text;
    };

    return traverse(parsed.root);
  } catch {
    return "";
  }
};

export const emptyEditorState = {
  root: {
    direction: "ltr",
    format: "",
    indent: 0,
    type: "root",
    version: 1,
    children: [
      {
        type: "paragraph",
        version: 1,
        format: "",
        indent: 0,
        textFormat: undefined,
        direction: null,
        children: [],
      },
    ],
  },
};

export function generateEditorStateFromString(input = "") {
  if (!input.trim()) {
    return JSON.parse(JSON.stringify(emptyEditorState));
  }

  // Split on line breaks → one paragraph per line
  const paragraphs = input.split(/\r?\n/);

  const children = paragraphs.map((line) => ({
    type: "paragraph",
    version: 1,
    format: "",
    indent: 0,
    textFormat: undefined,
    direction: null,
    children: line
      ? [
          {
            type: "text",
            version: 1,
            text: line,
            format: "",
            detail: 0,
            mode: "normal",
            style: "",
          },
        ]
      : [],
  }));

  return {
    root: {
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
      children,
    },
  };
}
