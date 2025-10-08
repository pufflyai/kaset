import { defineSlotRecipe } from "@chakra-ui/react";
import { fieldsetAnatomy } from "@chakra-ui/react/anatomy";

export const fieldsetSlotRecipe = defineSlotRecipe({
  slots: fieldsetAnatomy.keys(),
  base: {
    legend: {
      mb: "2xs",
    },
  },
});
