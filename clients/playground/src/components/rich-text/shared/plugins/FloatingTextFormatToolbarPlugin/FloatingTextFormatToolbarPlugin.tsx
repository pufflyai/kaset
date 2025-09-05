import "./FloatingTextFormatToolbarPlugin.css";

import { Tooltip } from "@/components/ui/tooltip";
import { Bold, Italic, Underline, Heading1, Heading2, Heading3 } from "lucide-react";
import { IconButton, Stack } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $isHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $findMatchingParent, mergeRegister } from "@lexical/utils";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CLICK_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import React, { type Dispatch, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { setFloatingElemPos } from "../LinkEditorPlugin/utils/setFloatingElemPos";

// Increase the vertical gap (negative places it below the selection) to avoid overlap
const GAP = -4;

const blockTypeToBlockName = {
  bullet: "Bulleted List",
  check: "Check List",
  code: "Code Block",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  number: "Numbered List",
  paragraph: "Normal",
  quote: "Quote",
};

function FloatingTextToolbar({
  editor,
  anchorElem,
  isToolbarActive,
  setIsToolbarActive,
}: {
  editor: LexicalEditor;
  anchorElem: HTMLElement;
  isToolbarActive: boolean;
  setIsToolbarActive: Dispatch<boolean>;
}): React.JSX.Element {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [blockType, setBlockType] = useState<keyof typeof blockTypeToBlockName>("paragraph");
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);

  const formatHeading = useCallback(
    (headingSize: HeadingTagType) => {
      if (blockType !== headingSize) {
        editor.update(() => {
          const selection = $getSelection();
          $setBlocksType(selection, () => $createHeadingNode(headingSize));
        });
      } else {
        editor.update(() => {
          const selection = $getSelection();
          $setBlocksType(selection, () => $createParagraphNode());
        });
      }
    },
    [blockType, editor],
  );

  const $updateToolbar = useCallback(() => {
    const selection = $getSelection();
    if ($isRangeSelection(selection)) {
      setIsBold(selection.hasFormat("bold"));
      setIsItalic(selection.hasFormat("italic"));
      setIsUnderline(selection.hasFormat("underline"));

      const anchorNode = selection.anchor.getNode();
      let element =
        anchorNode.getKey() === "root"
          ? anchorNode
          : $findMatchingParent(anchorNode, (e) => {
              const parent = e.getParent();
              return parent !== null && $isRootOrShadowRoot(parent);
            });

      if (element === null) {
        element = anchorNode.getTopLevelElementOrThrow();
      }

      const type = $isHeadingNode(element) ? element.getTag() : element.getType();
      if (type in blockTypeToBlockName) {
        setBlockType(type as keyof typeof blockTypeToBlockName);
      }
    }
  }, []);

  const $updateFloatingToolbar = useCallback(() => {
    const selection = $getSelection();
    const editorElem = editorRef.current;
    const nativeSelection = window.getSelection();

    if (editorElem === null) {
      return;
    }

    const rootElement = editor.getRootElement();

    // Show floating toolbar when there's a non-collapsed text selection
    if (
      selection !== null &&
      $isRangeSelection(selection) &&
      !selection.isCollapsed() &&
      nativeSelection !== null &&
      !nativeSelection.isCollapsed &&
      rootElement !== null &&
      rootElement.contains(nativeSelection.anchorNode) &&
      editor.isEditable()
    ) {
      const domRect: DOMRect | undefined = nativeSelection.getRangeAt(0).getBoundingClientRect();

      if (domRect) {
        // Anchor to the bottom of the selection to avoid overlap with tall selections
        const bottomRect = new DOMRect(domRect.left, domRect.bottom, 0, 0);
        setFloatingElemPos(bottomRect, editorElem, anchorElem, GAP);
      }

      setIsToolbarActive(true);
    } else {
      if (rootElement !== null) {
        setFloatingElemPos(null, editorElem, anchorElem);
      }
      setIsToolbarActive(false);
    }

    $updateToolbar();

    return true;
  }, [anchorElem, editor, setIsToolbarActive, $updateToolbar]);

  useEffect(() => {
    const scrollerElem = anchorElem.parentElement;

    const update = () => {
      editor.getEditorState().read(() => {
        $updateFloatingToolbar();
      });
    };

    window.addEventListener("resize", update);

    if (scrollerElem) {
      scrollerElem.addEventListener("scroll", update);
    }

    return () => {
      window.removeEventListener("resize", update);
      if (scrollerElem) {
        scrollerElem.removeEventListener("scroll", update);
      }
    };
  }, [anchorElem.parentElement, editor, $updateFloatingToolbar]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          $updateFloatingToolbar();
        });
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        (_payload) => {
          $updateFloatingToolbar();
          return false;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CLICK_COMMAND,
        (_payload) => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            $updateFloatingToolbar();
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH,
      ),
    );
  }, [editor, $updateFloatingToolbar]);

  return (
    <div ref={editorRef} className={`floating-text-format-toolbar ${isToolbarActive ? "active" : ""}`}>
      <Stack direction="row" gap="0.5" alignItems="center">
        {/* Text formatting buttons */}
        <Tooltip content="Bold">
          <IconButton
            data-active={isBold || undefined}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold");
            }}
            variant="ghost"
            aria-label="Bold"
            size="xs"
          >
            <Bold size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Italic">
          <IconButton
            data-active={isItalic || undefined}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic");
            }}
            variant="ghost"
            aria-label="Italic"
            size="xs"
          >
            <Italic size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Underline">
          <IconButton
            data-active={isUnderline || undefined}
            onClick={() => {
              editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline");
            }}
            variant="ghost"
            aria-label="Underline"
            size="xs"
          >
            <Underline size={14} />
          </IconButton>
        </Tooltip>

        {/* Separator */}
        <Stack as="span" height="1rem" mx="0.5">
          <span
            style={{
              borderLeft: "1px solid",
              height: "100%",
              borderColor: "var(--chakra-colors-border-secondary)",
            }}
          />
        </Stack>

        {/* Heading buttons */}
        <Tooltip content="Heading 1">
          <IconButton
            data-active={blockType === "h1" || undefined}
            variant="ghost"
            aria-label="Heading 1"
            size="xs"
            onClick={() => {
              formatHeading("h1");
            }}
          >
            <Heading1 size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Heading 2">
          <IconButton
            data-active={blockType === "h2" || undefined}
            variant="ghost"
            aria-label="Heading 2"
            size="xs"
            onClick={() => {
              formatHeading("h2");
            }}
          >
            <Heading2 size={14} />
          </IconButton>
        </Tooltip>
        <Tooltip content="Heading 3">
          <IconButton
            data-active={blockType === "h3" || undefined}
            variant="ghost"
            aria-label="Heading 3"
            size="xs"
            onClick={() => {
              formatHeading("h3");
            }}
          >
            <Heading3 size={14} />
          </IconButton>
        </Tooltip>
      </Stack>
    </div>
  );
}

function useFloatingTextToolbar(editor: LexicalEditor, anchorElem: HTMLElement): React.JSX.Element | null {
  const [isToolbarActive, setIsToolbarActive] = useState(false);

  return createPortal(
    <FloatingTextToolbar
      editor={editor}
      anchorElem={anchorElem}
      isToolbarActive={isToolbarActive}
      setIsToolbarActive={setIsToolbarActive}
    />,
    anchorElem,
  );
}

export function FloatingTextFormatToolbarPlugin({
  anchorElem = document.body,
}: {
  anchorElem?: HTMLElement;
}): React.JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  return useFloatingTextToolbar(editor, anchorElem);
}
