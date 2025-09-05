import { defineSlotRecipe } from "@chakra-ui/react";
import { menuAnatomy } from "@chakra-ui/react/anatomy";

export const menuSlotRecipe = defineSlotRecipe({
  slots: menuAnatomy.keys(),
  base: {
    itemGroupLabel: {
      ml: "{sm}",
      mb: "{xs}",
      mt: "0",
      textStyle: "label/S/regular",
      fontWeight: "normal",
      color: "foreground.secondary",
    },

    item: {
      bg: "background.primary",
      color: "foreground.primary",
      textStyle: "label/M/regular",
      px: "0.5rem",
      h: "2.25rem",
      _hover: { bg: "background.secondary" },
      _focus: { bg: "background.secondary" },
      _active: { bg: "background.tertiary" },
    },

    content: {
      display: "flex",
      flexDirection: "column",
      gap: "2xs",
      borderRadius: "sm",
      py: "xs",
      bg: "background.primary",
      border: "1px solid border.primary",
      zIndex: "dropdown",
      textStyle: "label/M/regular",
    },
  },
});
