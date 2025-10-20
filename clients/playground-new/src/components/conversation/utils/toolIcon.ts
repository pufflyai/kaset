import { isOpfsToolIconName, type IconName } from "@/utils/getIcon";

const DEFAULT_TOOL_ICON: IconName = "dot";

export const toolTypeToIconName = (type?: string): IconName => {
  if (!type) return DEFAULT_TOOL_ICON;

  const t = type.replace(/^tool-/, "");

  if (isOpfsToolIconName(t)) return t;

  switch (t) {
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
};
