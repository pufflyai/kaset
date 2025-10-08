import { defineRecipe } from "@chakra-ui/react";

export const textareaRecipe = defineRecipe({
  base: {
    paddingX: "sm",
    paddingY: "xs",
    opacity: "1",
    outline: "2px",
    color: "foreground.primary",
    border: "1px solid",
    borderColor: "border.primary",
    focusRingColor: "border.primary",
    _placeholder: {
      color: "foreground.tertiary",
    },
  },
});
