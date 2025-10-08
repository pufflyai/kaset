import { defineSlotRecipe } from "@chakra-ui/react";
import { drawerAnatomy as parts } from "@chakra-ui/react/anatomy";

export const drawerSlotRecipe = defineSlotRecipe({
  slots: parts.keys(),
  base: {
    header: {
      fontWeight: "medium",
      textStyle: "label/M/medium",
    },
    content: {
      bg: "background.primary",
    },
  },
});
