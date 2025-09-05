import { Box } from "@chakra-ui/react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TreeView } from "@lexical/react/LexicalTreeView";

export function TreeViewPlugin() {
  const [editor] = useLexicalComposerContext();
  return (
    <Box fontSize="xs" color="foreground.secondary" padding="4">
      <TreeView
        treeTypeButtonClassName="debug-treetype-button"
        timeTravelButtonClassName="debug-timetravel-button"
        timeTravelPanelButtonClassName="debug-timetravel-button"
        timeTravelPanelClassName="debug-timetravel-panel"
        timeTravelPanelSliderClassName="debug-timetravel-slider"
        viewClassName="tree-view-output"
        editor={editor}
      />
    </Box>
  );
}
