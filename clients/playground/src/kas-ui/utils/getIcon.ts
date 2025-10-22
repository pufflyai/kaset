/**
 * Icon helpers for the playground UI.
 *
 * - Lookup lucide icons by semantic name so we can share a single map.
 * - Provide file-extension aware icons for the file explorer.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CornerDownRight,
  DotIcon,
  File,
  FileArchive,
  FileChartLine,
  FileCode,
  FileCog,
  FileDiff,
  FileDown,
  FileImage,
  FileJson,
  FilePen,
  FileSpreadsheet,
  FileText,
  FileUp,
  Globe,
  ListTree,
  Move,
  Play,
  Search,
  Terminal,
  Trash2,
} from "lucide-react";

const opfsToolIconMap = {
  opfs_shell: Terminal,
  opfs_ls: ListTree,
  opfs_read_file: FileText,
  opfs_write_file: FilePen,
  opfs_delete_file: Trash2,
  opfs_patch: FileDiff,
  opfs_upload_files: FileUp,
  opfs_download_file: FileDown,
  opfs_move_file: Move,
} as const satisfies Record<string, LucideIcon>;

const baseIconMap = {
  dot: DotIcon,
  plugin: DotIcon,
  copy: Copy,
  danger: AlertTriangle,
  check: Check,
  play: Play,
  "arrow-down": ArrowDown,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  "corner-down-right": CornerDownRight,
  search: Search,
  browser: Globe,
  file: File,
} as const satisfies Record<string, LucideIcon>;

const iconMap = {
  ...baseIconMap,
  ...opfsToolIconMap,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof iconMap;
export type OpfsToolIconName = keyof typeof opfsToolIconMap;

export function isOpfsToolIconName(value: string): value is OpfsToolIconName {
  return Object.prototype.hasOwnProperty.call(opfsToolIconMap, value);
}

export function getIconComponent(name: IconName): LucideIcon {
  return iconMap[name];
}

/**
 * Maps file extensions to appropriate lucide-react icon components for TreeView.
 *
 * This helper function provides a mapping from common file extensions to
 * the appropriate LucideIcon components that can be used in TreeView nodes.
 *
 * @param filename - The filename or path to get the icon for
 * @returns A LucideIcon component to render for the file
 */
export function getFileTypeIcon(filename: string): LucideIcon {
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  // Tabular data files
  if (["csv", "tsv", "xlsx", "xls", "parquet"].includes(extension)) {
    return FileSpreadsheet;
  }

  // Code files
  if (
    [
      "sql",
      "py",
      "js",
      "ts",
      "jsx",
      "tsx",
      "java",
      "cpp",
      "c",
      "h",
      "css",
      "scss",
      "sass",
      "php",
      "rb",
      "go",
      "rs",
      "kt",
      "swift",
    ].includes(extension)
  ) {
    return FileCode;
  }

  // JSON files
  if (["json", "jsonl", "ndjson"].includes(extension)) {
    // Special case: JSON files in visualizations folder should use visualization icon
    if (filename.includes("/visualizations/")) {
      return FileChartLine;
    }
    return FileJson;
  }

  // Text/markdown files
  if (["md", "txt", "rst", "org"].includes(extension)) {
    return FileText;
  }

  // Configuration files
  if (["yaml", "yml", "toml", "ini", "conf", "config"].includes(extension)) {
    return FileCog;
  }

  // Documentation files
  if (["pdf", "doc", "docx", "rtf"].includes(extension)) {
    return FileText;
  }

  // Image files
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(extension)) {
    return FileImage;
  }

  // Archive files
  if (["zip", "tar", "gz", "rar", "7z"].includes(extension)) {
    return FileArchive;
  }

  // Default for unknown files
  return File;
}

export function getIndicatorIcon(indicator: IconName): LucideIcon {
  return getIconComponent(indicator);
}
