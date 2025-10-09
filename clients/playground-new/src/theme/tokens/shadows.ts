// Primitive shadow tokens
export const shadows = {
  "low-light": { value: "0px 2px 4px 0px rgba(0, 0, 0, 0.10)" },
  "mid-light": { value: "0px 6px 12px 0px rgba(0, 0, 0, 0.10)" },
  "high-light": { value: "0px 12px 24px 0px rgba(0, 0, 0, 0.10)" },
  "low-dark": { value: "0px 2px 4px 0px rgba(255,255,255,0.025)" },
  "mid-dark": { value: "0px 6px 12px 0px rgba(255,255,255,0.025)" },
  "high-dark": { value: "0px 12px 24px 0px rgba(255,255,255,0.025)" },
  "desktop-icon-label-text-light": { value: "0px 1px 3px rgba(15, 23, 42, 0.45)" },
  "desktop-icon-label-text-dark": { value: "0px 1px 3px rgba(8, 15, 35, 0.75)" },
  "desktop-icon-label-text-selected-light": { value: "0px 1px 3px rgba(37, 99, 235, 0.55)" },
  "desktop-icon-label-text-selected-dark": { value: "0px 2px 4px rgba(37, 99, 235, 0.75)" },
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
  "desktop-icon-label": {
    value: {
      base: "{shadows.desktop-icon-label-text-light}",
      _dark: "{shadows.desktop-icon-label-text-dark}",
    },
  },
  "desktop-icon-label-selected": {
    value: {
      base: "{shadows.desktop-icon-label-text-selected-light}",
      _dark: "{shadows.desktop-icon-label-text-selected-dark}",
    },
  },
};
