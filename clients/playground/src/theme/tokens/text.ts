import { defineTextStyles } from "@chakra-ui/react";

export const textStyles = defineTextStyles({
  brand: {
    value: {
      fontFamily: "brand",
      fontSize: "4xl",
      fontWeight: "500",
    },
  },
  "heading/display/L": {
    value: {
      fontFamily: "display",
      fontWeight: "600",
      fontSize: ["5xl", "5xl", "5xl", "6xl"],
      lineHeight: "120%",
    },
  },
  "heading/display/M": {
    value: {
      fontFamily: "display",
      fontWeight: "600",
      fontSize: ["4xl", "5xl"],
      lineHeight: "120%",
    },
  },
  "heading/display/S": {
    value: {
      fontFamily: "display",
      fontWeight: "600",
      fontSize: ["3xl", "4xl"],
      lineHeight: "120%",
    },
  },
  "heading/XL": {
    value: {
      fontFamily: "heading",
      fontSize: "5xl",
      fontWeight: "500",
      lineHeight: "120%",
    },
  },
  "heading/L": {
    value: {
      fontFamily: "heading",
      fontSize: "4xl",
      fontWeight: "500",
      lineHeight: "110%",
    },
  },
  "heading/M": {
    value: {
      fontFamily: "heading",
      fontSize: "3xl",
      fontWeight: "500",
      lineHeight: "120%",
    },
  },
  "heading/S": {
    value: {
      fontFamily: "heading",
      fontSize: "2xl",
      fontWeight: "500",
      lineHeight: "120%",
    },
  },
  "label/XL/regular": {
    value: {
      fontFamily: "label",
      fontSize: "2xl",
      fontWeight: "400",
      lineHeight: "150%",
      letterSpacing: "0.16px",
    },
  },
  "label/L/regular": {
    value: {
      fontFamily: "label",
      fontSize: "lg",
      fontWeight: "400",
      lineHeight: "20px",
      letterSpacing: "0.16px",
    },
  },
  "label/L/medium": {
    value: {
      fontFamily: "label",
      fontSize: "lg",
      fontWeight: "500",
      lineHeight: "20px",
      letterSpacing: "0.16px",
    },
  },
  "label/L/medium/underline": {
    value: {
      textDecoration: "underline",
      fontFamily: "label",
      fontSize: "lg",
      fontWeight: "500",
      lineHeight: "20px",
      letterSpacing: "0.16px",
    },
  },
  "label/L/medium/uppercase": {
    value: {
      letterSpacing: "0.089rem",
      fontFamily: "label",
      fontWeight: "600",
      fontSize: "lg",
      lineHeight: "150%",
      textTransform: "uppercase",
      color: "foreground.secondary",
    },
  },
  "label/M/regular": {
    value: {
      fontFamily: "label",
      fontSize: "md",
      fontWeight: "400",
      lineHeight: "150%",
      letterSpacing: "0.14px",
    },
  },
  "label/M/regular/underline": {
    value: {
      fontFamily: "label",
      fontSize: "md",
      fontWeight: "400",
      lineHeight: "150%",
      textDecoration: "underline",
      letterSpacing: "0.14px",
    },
  },
  "label/M/medium": {
    value: {
      fontFamily: "label",
      fontSize: "md",
      fontWeight: "500",
      lineHeight: "150%",
      letterSpacing: "0.14px",
    },
  },
  "label/S/regular": {
    value: {
      fontFamily: "label",
      fontSize: "sm",
      fontWeight: "400",
      lineHeight: "150%",
      letterSpacing: "0.12px",
    },
  },
  "label/S/medium": {
    value: {
      fontFamily: "label",
      fontSize: "sm",
      fontWeight: "500",
      lineHeight: "150%",
      letterSpacing: "0.12px",
    },
  },
  "label/S/italic": {
    value: {
      fontFamily: "label",
      fontSize: "sm",
      fontWeight: "400",
      lineHeight: "150%",
      letterSpacing: "0.12px",
      fontStyle: "italic",
    },
  },
  "label/XS": {
    value: {
      fontFamily: "label",
      fontSize: "xs",
      fontWeight: "400",
      lineHeight: "150%",
      letterSpacing: "0.1px",
    },
  },
  "paragraph/M/regular": {
    value: {
      fontFamily: "body",
      fontSize: "md",
      fontWeight: "400",
      lineHeight: "171%",
      letterSpacing: "0.14px",
    },
  },
  "paragraph/M/medium": {
    value: {
      fontFamily: "body",
      fontSize: "md",
      fontWeight: "500",
      lineHeight: "171%",
      letterSpacing: "0.14px",
    },
  },
  "paragraph/L/regular": {
    value: {
      fontFamily: "body",
      fontSize: "lg",
      fontWeight: "400",
      lineHeight: "150%",
      letterSpacing: "0.14px",
    },
  },
  "paragraph/L/medium": {
    value: {
      fontFamily: "body",
      fontSize: "lg",
      fontWeight: "500",
      lineHeight: "150%",
      letterSpacing: "0.14px",
    },
  },
  "paragraph/XL/regular": {
    value: {
      fontFamily: "body",
      fontWeight: "400",
      lineHeight: "150%",
      fontSize: ["xl", "2xl"],
      color: "foreground.primary",
      letterSpacing: "0.14px",
    },
  },
  "paragraph/XL/medium": {
    value: {
      fontFamily: "body",
      fontWeight: "500",
      lineHeight: "150%",
      fontSize: ["xl", "2xl"],
      color: "foreground.primary",
      letterSpacing: "0.14px",
    },
  },
} as any);
