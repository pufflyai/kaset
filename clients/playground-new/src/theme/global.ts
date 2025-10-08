export const globalCss = {
  ":root": {
    "--focus-border": "border.accent",
    "--separator-border": "transparent !important",
  },

  "*::selection": {
    background: "background.highlight",
  },

  html: {
    height: "100%",
    overflow: "auto",
  },

  body: {
    height: "100%",
    fontFamily: "body",
    fontWeight: "regular",
    fontSize: "md",
    bg: "background.primary",
    color: "foreground.primary",
    borderColor: "border.primary",
    overflowY: "auto",
    overflowX: "hidden",
  },

  "#root": { height: "100%" },

  ".sash": {
    zIndex: "docked",
  },
};
