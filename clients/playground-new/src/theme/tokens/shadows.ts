// Primitive shadow tokens
export const shadows = {
  "low-light": { value: "0px 2px 4px 0px rgba(0, 0, 0, 0.10)" },
  "mid-light": { value: "0px 6px 12px 0px rgba(0, 0, 0, 0.10)" },
  "high-light": { value: "0px 12px 24px 0px rgba(0, 0, 0, 0.10)" },
  "low-dark": { value: "0px 2px 4px 0px rgba(255,255,255,0.025)" },
  "mid-dark": { value: "0px 6px 12px 0px rgba(255,255,255,0.025)" },
  "high-dark": { value: "0px 12px 24px 0px rgba(255,255,255,0.025)" },
};

// Semantic shadow tokens for light/dark mode
export const semanticShadows = {
  low: {
    value: {
      base: "{shadows.low-light}",
      _dark: "{shadows.low-dark}",
    },
  },
  mid: {
    value: {
      base: "{shadows.mid-light}",
      _dark: "{shadows.mid-dark}",
    },
  },
  high: {
    value: {
      base: "{shadows.high-light}",
      _dark: "{shadows.high-dark}",
    },
  },
};
