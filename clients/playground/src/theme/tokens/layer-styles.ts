import { defineLayerStyles } from "@chakra-ui/react";

export const layerStyles = defineLayerStyles({
  modal: {
    value: {
      paddingX: "xs",
      paddingY: "sm",
      borderRadius: "sm",
      bg: "background.primary",
      border: "1px solid",
      borderColor: "border.primary",
      boxShadow: "mid",
    } as any,
  },
});
