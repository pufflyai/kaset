/**
 * Maps file extensions to appropriate lucide-react icon components for TreeView.
 *
 * This helper function provides a mapping from common file extensions to
 * the appropriate LucideIcon components that can be used in TreeView nodes.
 *
 * @param filename - The filename or path to get the icon for
 * @returns A LucideIcon component to render for the file
 */
import type { LucideIcon } from "lucide-react";
import {
  File,
  FileArchive,
  FileChartLine,
  FileCode,
  FileCog,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

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
