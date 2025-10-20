import { loadTheme } from "__MISSING_PATH__";

const missingDependency = "__MISSING_PATH__";
const errorNote = "__ERROR_REASON__";

export function boot(target?: HTMLElement) {
  const element = target ?? document.createElement("div");

  element.textContent = "This bundle never finishes mounting.";
  element.style.fontFamily = "system-ui, sans-serif";
  element.style.color = "#991b1b";
  element.dataset.errorNote = errorNote;
  element.dataset.missingDependency = missingDependency;

  // This call keeps the bundle broken because the module never resolves.
  loadTheme(element);

  return element;
}
