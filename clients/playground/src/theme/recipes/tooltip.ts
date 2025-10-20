import { defineSlotRecipe } from "@chakra-ui/react";
import { tooltipAnatomy } from "@chakra-ui/react/anatomy";

export const tooltipRecipe = defineSlotRecipe({
  slots: tooltipAnatomy.keys(),
  base: {
    content: {
      bg: "background.inverse",
      color: "foreground.inverse",
    },
    arrow: {
      bg: "background.inverse",
    },
  },
});
