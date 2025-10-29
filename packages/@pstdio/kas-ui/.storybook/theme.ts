import { createSystem, defaultConfig, defineConfig, defineTextStyles } from "@chakra-ui/react";

const textStyles = defineTextStyles({
  "label/XS": {
    value: {
      fontFamily: "label",
      fontSize: "0.75rem",
      lineHeight: "150%",
      letterSpacing: "0.01rem",
      fontWeight: 400,
    },
  },
  "label/S/regular": {
    value: {
      fontFamily: "label",
      fontSize: "0.875rem",
      lineHeight: "150%",
      letterSpacing: "0.012rem",
      fontWeight: 400,
    },
  },
  "label/SM/regular": {
    value: {
      fontFamily: "label",
      fontSize: "0.8125rem",
      lineHeight: "150%",
      letterSpacing: "0.011rem",
      fontWeight: 400,
    },
  },
  "label/M/regular": {
    value: {
      fontFamily: "label",
      fontSize: "1rem",
      lineHeight: "150%",
      letterSpacing: "0.014rem",
      fontWeight: 400,
    },
  },
});

const config = defineConfig({
  theme: {
    tokens: {
      fonts: {
        heading: { value: "'Inter', 'Segoe UI', sans-serif" },
        body: { value: "'Inter', 'Segoe UI', sans-serif" },
        label: { value: "'Inter', 'Segoe UI', sans-serif" },
        display: { value: "'Inter', 'Segoe UI', sans-serif" },
        mono: { value: "'JetBrains Mono', 'Fira Code', monospace" },
      },
      spacing: {
        none: { value: "0" },
        "2xs": { value: "0.25rem" },
        xxs: { value: "0.375rem" },
        xs: { value: "0.5rem" },
        sm: { value: "0.75rem" },
        md: { value: "1rem" },
        lg: { value: "1.5rem" },
        xl: { value: "2rem" },
        "2xl": { value: "2.5rem" },
        "3xl": { value: "3rem" },
        "3.5xl": { value: "3.5rem" },
        "4xl": { value: "4rem" },
      },
      radii: {
        none: { value: "0" },
        "2xs": { value: "0.125rem" },
        xs: { value: "0.25rem" },
        sm: { value: "0.5rem" },
        md: { value: "0.75rem" },
        lg: { value: "1rem" },
        xl: { value: "2rem" },
        full: { value: "9999px" },
      },
    },
    semanticTokens: {
      colors: {
        "foreground.primary": { value: { _light: "#0F172A", _dark: "#F8FAFC" } },
        "foreground.secondary": { value: { _light: "#475569", _dark: "#94A3B8" } },
        "foreground.feedback.success": { value: { _light: "#22C55E", _dark: "#4ADE80" } },
        "foreground.feedback.alert": { value: { _light: "#EF4444", _dark: "#F87171" } },
        "foreground.blue-dark": { value: { _light: "#1D4ED8", _dark: "#93C5FD" } },
        "foreground.accent-blue-dark": { value: { _light: "#1E40AF", _dark: "#BFDBFE" } },
        "accent.primary": { value: { _light: "#2563EB", _dark: "#60A5FA" } },
        "border.secondary": { value: { _light: "#CBD5F5", _dark: "#1E293B" } },
        "border.subtle": { value: { _light: "#E2E8F0", _dark: "#1F2937" } },
        "bg.primary": { value: { _light: "#FFFFFF", _dark: "#0F172A" } },
        "bg.accent-secondary.red-light": { value: { _light: "#FEE2E2", _dark: "#7F1D1D" } },
        "background.secondary": { value: { _light: "#F1F5F9", _dark: "#1F2937" } },
        "background.tertiary": { value: { _light: "#E2E8F0", _dark: "#111827" } },
        "color.primary": { value: { _light: "#0F172A", _dark: "#F8FAFC" } },
        "fg.muted": { value: { _light: "#64748B", _dark: "#94A3B8" } },
      },
    },
    textStyles,
  },
});

const system = createSystem(defaultConfig, config);

export default system;
