import { defineRecipe } from "@chakra-ui/react";

export const inputRecipe = defineRecipe({
  base: {
    px: "sm",
    borderRadius: "sm",
    border: "1px solid",
    bg: "background.primary",
    color: "foreground.primary",
    borderColor: "border.secondary",
    focusRingColor: "border.primary",
    _hover: { borderColor: "border.primary" },
    _placeholder: { color: "text.placeholder" },
  },
});
