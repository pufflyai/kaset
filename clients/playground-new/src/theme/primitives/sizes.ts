export const sp = {
  0: "0rem", // 0px
  25: "0.125rem", // 2px
  50: "0.25rem", // 4px
  100: "0.5rem", // 8px
  150: "0.75rem", // 12px
  200: "1rem", // 16px
  250: "1.25rem", // 20px
  300: "1.5rem", // 24px
  400: "2rem", // 32px
  500: "2.5rem", // 40px
  600: "3rem", // 48px
  700: "3.5rem", // 56px
  800: "4rem", // 64px
  900: "4.5rem", // 72px
  1000: "5rem", // 80px
  1200: "6rem", // 96px
  1600: "8rem", // 128px
  2000: "10rem", // 160px
  3000: "15rem", // 240px
  4000: "20rem", // 320px
};

export const spacing = {
  none: { value: "0" },
  "2xs": { value: sp[50] },
  xs: { value: sp[100] },
  sm: { value: sp[150] },
  md: { value: sp[200] },
  lg: { value: sp[300] },
  xl: { value: sp[400] },
  "2xl": { value: sp[500] },
  "3xl": { value: sp[600] },
  "3.5xl": { value: sp[700] },
  "4xl": { value: sp[800] },
  "4.5xl": { value: sp[900] },
  "5xl": { value: sp[1600] },
};

export const radii = {
  none: { value: "0" },
  "2xs": { value: sp[25] },
  xs: { value: sp[50] },
  sm: { value: sp[100] },
  md: { value: sp[150] },
  lg: { value: sp[200] },
  xl: { value: sp[400] },
  full: { value: "100%" },
};
