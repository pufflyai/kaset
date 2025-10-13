import { defineSlotRecipe } from "@chakra-ui/react";
import { dialogAnatomy } from "@chakra-ui/react/anatomy";

export const dialogSlotRecipe = defineSlotRecipe({
  slots: dialogAnatomy.keys(),
  base: {
    content: {
      bg: "background.primary",
    },
  },
});
