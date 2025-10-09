import type { ThemePreference } from "@/state/types";

const CLASS_LIGHT = "light";
const CLASS_DARK = "dark";

export const applyThemePreference = (theme: ThemePreference) => {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const body = document.body;
  const targetClass = theme === "dark" ? CLASS_DARK : CLASS_LIGHT;
  const oppositeClass = theme === "dark" ? CLASS_LIGHT : CLASS_DARK;

  root.classList.remove(oppositeClass);
  root.classList.add(targetClass);
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;

  if (body) {
    body.classList.remove(oppositeClass);
    body.classList.add(targetClass);
    body.setAttribute("data-theme", theme);
    body.style.colorScheme = theme;
  }
};
