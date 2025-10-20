import { defineSlotRecipe } from "@chakra-ui/react";

export const editableSlotRecipe = defineSlotRecipe({
  slots: ["preview", "input", "textarea"] as const,
  base: {
    preview: {
      textStyle: "label/L/medium",
      borderRadius: "2xs",
      focusRingColor: "border.primary",
      py: "0",
      lineHeight: "1.5rem",
      transitionProperty: "common",
      transitionDuration: "normal",
      _hover: { bg: "background.secondary" },
    },
    input: {
      textStyle: "label/L/medium",
      borderRadius: "2xs",
      focusRingColor: "border.primary",
      py: "0",
      lineHeight: "1.5rem",
      transitionProperty: "common",
      transitionDuration: "normal",
      bg: "background.primary",
      width: "auto",
      _focusVisible: { boxShadow: "none" },
      _placeholder: { color: "foreground.secondary" },
    },
    textarea: {
      textStyle: "label/L/medium",
      borderRadius: "2xs",
      focusRingColor: "border.primary",
      py: "0",
      transitionProperty: "common",
      transitionDuration: "normal",
      bg: "background.secondary",
      width: "auto",
      _focusVisible: { boxShadow: "none" },
      _placeholder: { color: "foreground.secondary" },
    },
  },
});
