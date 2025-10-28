import { isOpfsToolIconName, type IconName } from "../utils/getIcon.ts";

const DEFAULT_TOOL_ICON: IconName = "dot";

export function toolTypeToIconName(type?: string): IconName {
  if (!type) return DEFAULT_TOOL_ICON;

  const normalized = type.replace(/^tool-/, "");
  if (isOpfsToolIconName(normalized)) {
    return normalized;
  }

  switch (normalized) {
    case "search":
      return "search";
    case "browser":
      return "browser";
    case "fs":
    case "file":
      return "file";
    default:
      return DEFAULT_TOOL_ICON;
  }
}
