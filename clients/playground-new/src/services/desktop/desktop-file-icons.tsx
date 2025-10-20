import { ROOT } from "@/constant";
import { ImagePreview } from "@/components/ui/image-preview";
import { TextEditor } from "@/components/ui/text-editor";
import type { DesktopApp } from "@/state/types";
import type { IconName } from "lucide-react/dynamic";

export const ROOT_FILE_PREFIX = "root-file:";
export const OPEN_DESKTOP_FILE_EVENT = "kaset:desktop-open-file";

const TEXT_EDITOR_WINDOW_SIZE = { width: 720, height: 560 };
const IMAGE_PREVIEW_WINDOW_SIZE = { width: 640, height: 520 };

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"] as const;

const CODE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".php",
  ".c",
  ".h",
  ".hpp",
  ".cpp",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
] as const;

const isImageFileName = (fileName: string) => {
  const lower = fileName.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const isCodeFileName = (fileName: string) => {
  const lower = fileName.toLowerCase();
  return CODE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const getIconForFileName = (fileName: string): IconName => {
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".txt")) {
    return "file-text";
  }

  if (lower.endsWith(".json") || lower.endsWith(".jsonl") || lower.endsWith(".ndjson")) {
    return "file-json";
  }

  if (
    lower.endsWith(".yaml") ||
    lower.endsWith(".yml") ||
    lower.endsWith(".toml") ||
    lower.endsWith(".ini") ||
    lower.endsWith(".conf") ||
    lower.endsWith(".config")
  ) {
    return "file-cog";
  }

  if (isImageFileName(fileName)) {
    return "file-image";
  }

  if (isCodeFileName(fileName)) {
    return "file-code";
  }

  return "file";
};

const getDisplayName = (path: string, override?: string) => {
  if (typeof override === "string") {
    const trimmed = override.trim();
    if (trimmed) return trimmed;
  }

  const segments = path.split("/");
  const last = segments[segments.length - 1];
  return last && last.trim() ? last.trim() : path;
};

const ensurePath = (path: string) => {
  const trimmed = (path ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");
  if (!trimmed) return ROOT;
  if (trimmed === ROOT || trimmed.startsWith(`${ROOT}/`)) return trimmed;
  return `${ROOT}/${trimmed}`;
};

export interface DesktopFileAppOptions {
  path: string;
  name?: string;
  description?: string;
}

export interface DesktopOpenFileDetail {
  path: string;
  displayName?: string;
}

export const normalizeDesktopFilePath = (path: string) => ensurePath(path);

export const createDesktopFileApp = (options: DesktopFileAppOptions): DesktopApp => {
  const normalizedPath = ensurePath(options.path);
  const displayName = getDisplayName(normalizedPath, options.name);
  const description =
    typeof options.description === "string" && options.description.trim()
      ? options.description.trim()
      : `View ${displayName} from ${ROOT}/`;

  const imageFile = isImageFileName(displayName);

  return {
    id: `${ROOT_FILE_PREFIX}${normalizedPath}`,
    title: displayName,
    icon: getIconForFileName(displayName),
    description,
    defaultSize: imageFile ? IMAGE_PREVIEW_WINDOW_SIZE : TEXT_EDITOR_WINDOW_SIZE,
    singleton: true,
    render: () =>
      imageFile ? (
        <ImagePreview filePath={normalizedPath} displayName={displayName} />
      ) : (
        <TextEditor filePath={normalizedPath} />
      ),
  };
};

export const getRootFilePathFromAppId = (appId: string): string | null => {
  if (!appId.startsWith(ROOT_FILE_PREFIX)) return null;
  return appId.slice(ROOT_FILE_PREFIX.length);
};

export const requestOpenDesktopFile = (path: string, options?: { displayName?: string }) => {
  if (typeof window === "undefined") return;

  const detail: DesktopOpenFileDetail = {
    path: ensurePath(path),
  };

  const displayName = options?.displayName;
  if (typeof displayName === "string" && displayName.trim()) {
    detail.displayName = displayName.trim();
  }

  console.info("[desktop] Dispatching open file event", detail);
  window.dispatchEvent(new CustomEvent<DesktopOpenFileDetail>(OPEN_DESKTOP_FILE_EVENT, { detail }));
};
