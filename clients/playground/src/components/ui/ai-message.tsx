import type { HTMLChakraProps, RecipeVariantProps } from "@chakra-ui/react";
import { createSlotRecipeContext, defineSlotRecipe } from "@chakra-ui/react";

const recipe = defineSlotRecipe({
  className: "ai-message",
  slots: ["root", "content"],
  base: {
    root: {
      display: "flex",
      width: "full",
      alignItems: "end",
      justifyContent: "end",
      gap: "sm",
    },
    content: {
      display: "flex",
      flexDirection: "column",
      gap: "sm",
      rounded: "lg",
      textStyle: "sm",
      px: "md",
      overflow: "hidden",
    },
  },
  variants: {
    from: {
      user: {
        root: {
          flexDirection: "row",
          "& > div": {
            marginLeft: "lg",
          },
        },
        content: {
          bg: "background.secondary",
          borderBottomRightRadius: 0,
        },
      },
      assistant: {
        root: {
          width: "full",
          flexDirection: "row-reverse",
        },
        content: {
          width: "full",
        },
      },
      developer: {
        root: {
          width: "full",
          flexDirection: "row-reverse",
        },
        content: {
          width: "full",
        },
      },
    },
  },
  defaultVariants: {
    from: "user",
  },
});

const { withProvider, withContext } = createSlotRecipeContext({ recipe });

type VariantProps = RecipeVariantProps<typeof recipe>;

export interface MessageRootProps extends HTMLChakraProps<"div">, VariantProps {}
export const MessageRoot = withProvider<HTMLDivElement, MessageRootProps>("div", "root");

export interface MessageContentProps extends HTMLChakraProps<"div">, VariantProps {}
export const MessageContent = withContext<HTMLDivElement, MessageContentProps>("div", "content");
