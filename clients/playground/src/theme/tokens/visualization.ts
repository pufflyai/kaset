import { blacks, blue, cyan, green, orange, pink, purple, red } from "../primitives/colors";

// TODO: find a better way to handle this

export const visualizationTokens = {
  text: {
    primary: {
      light: blacks["800"].value,
      dark: blacks["200"].value,
    },
    secondary: {
      light: blacks["600"].value,
      dark: blacks["500"].value,
    },
  },
  grid: {
    light: blacks["400"].value,
    dark: blacks["800"].value,
  },
  axis: {
    light: blacks["300"].value,
    dark: blacks["700"].value,
  },
  categorical: {
    1: {
      light: blue["300"].value,
      dark: blue["300"].value,
    },
    2: {
      light: orange["500"].value,
      dark: orange["500"].value,
    },
    3: {
      light: purple["700"].value,
      dark: purple["700"].value,
    },
    4: {
      light: red["500"].value,
      dark: red["600"].value,
    },
    5: {
      light: pink["500"].value,
      dark: pink["500"].value,
    },
    6: {
      light: cyan["800"].value,
      dark: green["500"].value,
    },
    7: {
      light: red["200"].value,
      dark: cyan["700"].value,
    },
    8: {
      light: blue["600"].value,
      dark: red["300"].value,
    },
    9: {
      light: pink["200"].value,
      dark: blue["600"].value,
    },
    10: {
      light: orange["800"].value,
      dark: green["200"].value,
    },
    11: {
      light: purple["300"].value,
      dark: purple["500"].value,
    },
    12: {
      light: cyan["400"].value,
      dark: pink["200"].value,
    },
  },
};
