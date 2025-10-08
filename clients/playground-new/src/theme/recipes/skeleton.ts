import { defineRecipe } from "@chakra-ui/react";

export const skeletonRecipe = defineRecipe({
  base: {
    ["--start-color"]: "foreground.primary",
    ["--end-color"]: "foreground.secondary",
  },
});
