import { defineSlotRecipe } from "@chakra-ui/react";
import { alertAnatomy } from "@chakra-ui/react/anatomy";

export const alertSlotRecipe = defineSlotRecipe({
  slots: alertAnatomy.keys(),
  base: {
    root: {
      pt: "xs",
      pb: "xs",
    },
  },
});
