import type { IconName } from "@/icons/Icon";

export const toolTypeToIconName = (type?: string): IconName => {
  if (!type) return "plugin";
  const t = type.replace(/^tool-/, "");
  switch (t) {
    case "search":
      return "search";
    case "browser":
      return "browser";
    case "fs":
    case "file":
      return "file";
    default:
      return "plugin";
  }
};
