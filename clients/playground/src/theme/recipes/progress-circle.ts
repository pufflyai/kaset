import { progressCircleSlotRecipe as baseProgressCircleSlotRecipe } from "@chakra-ui/react/theme";

const baseSizeVariants = baseProgressCircleSlotRecipe.variants?.size ?? {};

export const progressCircleSlotRecipe = {
  ...baseProgressCircleSlotRecipe,
  variants: {
    ...baseProgressCircleSlotRecipe.variants,
    size: {
      ...baseSizeVariants,
      "2xs": {
        circle: {
          "--size": "14px",
          "--thickness": "2px",
        },
        valueText: {
          textStyle: "2xs",
        },
      },
    },
  },
};
