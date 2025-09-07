import { defineRecipe } from "@chakra-ui/react";

export const buttonRecipe = defineRecipe({
  base: {
    borderRadius: "sm",
    transition: "all 0.1s ease-in-out",
    fontFamily: "label",
    fontWeight: "500",
    color: "foreground.primary",
    bg: "background.primary",
    borderColor: "border.secondary",
    _disabled: {
      opacity: 1,
      color: "foreground.tertiary",
      bg: "background.secondary",
      _hover: { bg: "background.secondary" },
    },
    _loading: {
      opacity: 1,
      color: "foreground.tertiary",
      bg: "background.secondary",
      _hover: { bg: "background.secondary" },
    },
  },
  variants: {
    variant: {
      "display-primary": {
        bg: "blacks.900",
        color: "foreground.inverse",
        borderRadius: "xl",
        outline: "none",
        border: "none",
        _hover: { bg: "blacks.800" },
      },
      "display-outline": {
        bg: "transparent",
        color: "foreground.primary",
        borderRadius: "xl",
        border: "2px solid {foreground.primary}",
        _hover: { bg: "background.secondary" },
        _active: { bg: "background.tertiary" },
      },
      "display-ghost": {
        bg: "transparent",
        color: "foreground.primary",
        borderRadius: "xl",
        _hover: { bg: "background.secondary" },
        _active: { bg: "background.tertiary" },
      },
      "display-link": {
        bg: "transparent",
        color: "foreground.primary",
        borderRadius: "xl",
        _hover: { textDecoration: "underline" },
        _active: { textDecoration: "underline" },
      },
      primary: {
        color: "text.selectable-primary",
        bg: "background.accent-primary.light",
        border: "none",
        _hover: { bg: "background.accent-primary.medium" },
        _active: { bg: "background.accent-primary.dark" },
      },
      secondary: {
        color: "foreground.primary",
        bg: "background.primary",
        border: "2px solid border.secondary",
        _hover: { bg: "background.secondary" },
        _active: { bg: "background.tertiary" },
        _disabled: {
          opacity: 1,
          color: "foreground.tertiary",
          borderColor: "border.secondary",
        },
      },
      outline: {
        color: "foreground.primary",
        bg: "background.primary",
        border: "border.secondary",
        _hover: { bg: "background.secondary" },
        _active: { bg: "background.tertiary" },
        _disabled: {
          opacity: 1,
          color: "foreground.tertiary",
          borderColor: "border.secondary",
        },
      },
      ghost: {
        color: "foreground.primary",
        bg: "transparent",
        border: "none",
        _hover: { bg: "background.secondary" },
        _active: { bg: "background.tertiary" },
        _disabled: {
          bg: "transparent",
          _hover: { bg: "transparent" },
        },
      },
      editor: {
        borderRadius: "lg",
        color: "foreground.primary",
        border: "1px solid border.primary",
        _hover: { bg: "background.secondary" },
        _active: { bg: "background.tertiary" },
        _disabled: { color: "foreground.tertiary" },
      },
    },
    size: {
      "2xl": {
        px: "1.5rem",
        h: "3.5rem",
        textStyle: "label/L/medium",
      },
      lg: {
        px: "1rem",
        h: "3rem",
        textStyle: "label/M/medium",
      },
      md: {
        textStyle: "label/M/medium",
      },
      sm: {
        px: "0.5rem",
        h: "2rem",
        textStyle: "label/S/medium",
      },
    },
  },

  defaultVariants: { size: "md", variant: "outline" },
});
