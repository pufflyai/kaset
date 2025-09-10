import { ErrorType } from "../errors";
import { getFs } from "../adapter/fs";
import { getFileHandle } from "../shared";

// ------------------------------
// Constants for text processing
// ------------------------------
export const DEFAULT_MAX_LINES_TEXT_FILE = 2000;
export const MAX_LINE_LENGTH_TEXT_FILE = 2000;
export const DEFAULT_ENCODING = "utf-8" as const;

// ------------------------------
// Small POSIX-style path helpers
// ------------------------------
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

function normalizePosix(p: string): string {
  p = toPosix(p);
  const parts = p.split("/").filter(Boolean);
  const stack: string[] = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

function splitSegments(p: string): string[] {
  const n = normalizePosix(p);
  return n ? n.split("/") : [];
}

/**
 * Compute relative path `to` from base `from`.
 * Keeps POSIX separators.
 */
function relativePosix(from: string, to: string): string {
  const a = splitSegments(from);
  const b = splitSegments(to);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const up = new Array(a.length - i).fill("..");
  const down = b.slice(i);
  const rel = [...up, ...down].join("/");
  return rel || ".";
}

/**
 * Looks up the specific MIME type for a file name or path.
 */
// Minimal, browser-safe extension -> MIME map to avoid Node path deps in bundles
const EXT_TO_MIME: Record<string, string> = {
  // Text
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  sql: "application/sql",
  xml: "application/xml",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  // Scripts
  js: "application/javascript",
  mjs: "application/javascript",
  cjs: "application/javascript",
  ts: "text/plain", // treat as text (avoid video/MP2T misclassification)
  tsx: "text/plain",
  jsx: "text/plain",
  // Images
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  ico: "image/x-icon",
  cur: "image/x-icon",
  svg: "image/svg+xml",
  svgz: "image/svg+xml",
  // Audio
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  wav: "audio/wav",
  oga: "audio/ogg",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  opus: "audio/opus",
  // Video
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  // Docs/other
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  tar: "application/x-tar",
  "7z": "application/x-7z-compressed",
  wasm: "application/wasm",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

function getExtensionLower(pathOrName: string): string | undefined {
  const name = pathOrName.split("/").pop() || pathOrName;
  const idx = name.lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1) return undefined;
  return name.slice(idx + 1).toLowerCase();
}

export function getSpecificMimeType(filePathOrName: string): string | undefined {
  const ext = getExtensionLower(filePathOrName);
  if (!ext) return undefined;
  return EXT_TO_MIME[ext];
}

// Allow callers to extend/override the built-in map at runtime
export function registerMimeTypes(map: Record<string, string>): void {
  for (const [key, value] of Object.entries(map)) {
    if (!key || !value) continue;
    EXT_TO_MIME[key.toLowerCase()] = value;
  }
}

/**
 * Checks if a path is within a given root directory (both POSIX-like strings).
 */
export { isWithinRoot } from "./path";

// ------------------------------
// Adapter helpers (no OPFS handle usage)
// ------------------------------

/**
 * Base64-encode an ArrayBuffer (chunked to avoid call stack issues).
 */
function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary);
}

// ------------------------------
// Binary detection and file type
// ------------------------------

/**
 * Determines if a file is likely binary based on content sampling.
 * @param file A File object (from OPFS)
 */
export async function isBinaryFile(file: File): Promise<boolean> {
  const fileSize = file.size;
  if (fileSize === 0) return false;

  const sampleSize = Math.min(4096, fileSize);
  const buf = new Uint8Array(await file.slice(0, sampleSize).arrayBuffer());

  let nonPrintableCount = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0) return true; // Null byte is a strong indicator
    if (b < 9 || (b > 13 && b < 32)) nonPrintableCount++;
  }
  return nonPrintableCount / buf.length > 0.3;
}

/**
 * Detects the type of file based on extension and content.
 * @param fileName Name or path of the file (used for extension/MIME lookup).
 * @param file Optional File for content-based fallback.
 */
export async function detectFileType(
  fileName: string,
  file?: File,
): Promise<"text" | "image" | "pdf" | "audio" | "video" | "binary" | "svg"> {
  const lower = fileName.toLowerCase();
  const dotIdx = lower.lastIndexOf(".");
  const ext = dotIdx >= 0 ? lower.slice(dotIdx) : "";

  // TypeScript files can be mis-typed as video/MP2T; treat as text.
  if ([".ts", ".mts", ".cts"].includes(ext)) return "text";
  if (ext === ".svg") return "svg";

  const lookedUpMimeType = getSpecificMimeType(fileName);
  if (lookedUpMimeType) {
    if (lookedUpMimeType === "image/svg+xml") return "svg";
    if (lookedUpMimeType.startsWith("image/")) return "image";
    if (lookedUpMimeType.startsWith("audio/")) return "audio";
    if (lookedUpMimeType.startsWith("video/")) return "video";
    if (lookedUpMimeType === "application/pdf") return "pdf";
  }

  // Common binary extensions (not exhaustive)
  if (
    [
      ".zip",
      ".tar",
      ".gz",
      ".7z",
      ".exe",
      ".dll",
      ".so",
      ".class",
      ".jar",
      ".war",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".ppt",
      ".pptx",
      ".odt",
      ".ods",
      ".odp",
      ".bin",
      ".dat",
      ".obj",
      ".o",
      ".a",
      ".lib",
      ".wasm",
      ".pyc",
      ".pyo",
    ].includes(ext)
  ) {
    return "binary";
  }

  // Fallback to content-based detection when possible
  if (file) {
    return (await isBinaryFile(file)) ? "binary" : "text";
  }

  return "text";
}

// ------------------------------
// Result interface (unchanged)
// ------------------------------
export interface ProcessedFileReadResult {
  llmContent: any; // string for text, Part for image/pdf/unreadable binary
  returnDisplay: string;
  error?: string; // Optional error message for the LLM if file processing failed
  errorType?: ErrorType; // Structured error type
  isTruncated?: boolean; // For text files, indicates if content was truncated
  originalLineCount?: number; // For text files
  linesShown?: [number, number]; // For text files [startLine, endLine] (1-based for display)
}

// ------------------------------
// Main: read & process a single OPFS file
// ------------------------------

export interface ProcessSingleFileOptions {
  /** Maximum file size in megabytes for text read path (default 20). */
  maxFileSizeMB?: number;
  /** Default max lines when `limit` is not specified (default 2000). */
  defaultMaxLines?: number;
  /** Max characters per line before truncation (default 2000). */
  maxLineLength?: number;
}

/**
 * Reads and processes a single file in OPFS, handling text, images, and PDFs.
 * @param filePath POSIX-like path within OPFS (e.g., 'project/src/index.ts').
 * @param rootDirectory POSIX-like path used as the logical project root for display (e.g., 'project').
 * @param _unused (ignored) legacy third parameter kept for backward compatibility.
 * @param offset Optional offset for text files (0-based line number).
 * @param limit Optional limit for text files (number of lines to read).
 * @param options Optional thresholds to override defaults (file size, lines, line length).
 */
export async function processSingleFileContent(
  filePath: string,
  rootDirectory: string,
  _unused?: unknown,
  offset?: number,
  limit?: number,
  options?: ProcessSingleFileOptions,
): Promise<ProcessedFileReadResult> {
  const normalizedFilePath = normalizePosix(filePath);
  const normalizedRootPath = normalizePosix(rootDirectory);

  try {
    // Resolve absolute path within OPFS and confirm it's a file
    let absPath: string;
    try {
      absPath = await getFileHandle(normalizedFilePath, /*create*/ false);
    } catch (e: any) {
      if (e?.name === "TypeMismatchError") {
        return {
          llmContent: "Could not read file because the provided path is a directory, not a file.",
          returnDisplay: "Path is a directory.",
          error: `Path is a directory, not a file: ${normalizedFilePath}`,
          errorType: ErrorType.TARGET_IS_DIRECTORY,
        };
      }
      if (e?.name === "NotFoundError" || e?.code === "ENOENT" || e?.code === 404) {
        return {
          llmContent: "Could not read file because no file was found at the specified path.",
          returnDisplay: "File not found.",
          error: `File not found: ${normalizedFilePath}`,
          errorType: ErrorType.FILE_NOT_FOUND,
        };
      }
      throw e;
    }

    const fs = await getFs();
    const stat = await fs.promises.stat(absPath);

    const maxMB = options?.maxFileSizeMB ?? 20;
    const fileSizeInMB = stat.size / (1024 * 1024);
    if (fileSizeInMB > maxMB) {
      return {
        llmContent: `File size exceeds the ${maxMB}MB limit.`,
        returnDisplay: `File size exceeds the ${maxMB}MB limit.`,
        error: `File size exceeds the ${maxMB}MB limit: ${normalizedFilePath} (${fileSizeInMB.toFixed(2)}MB)`,
        errorType: ErrorType.FILE_TOO_LARGE,
      };
    }

    // Determine type
    const fileType = await detectFileType(normalizedFilePath);
    const relativePathForDisplay = toPosix(relativePosix(normalizedRootPath, normalizedFilePath));

    switch (fileType) {
      case "binary": {
        return {
          llmContent: `Cannot display content of binary file: ${relativePathForDisplay}`,
          returnDisplay: `Skipped binary file: ${relativePathForDisplay}`,
        };
      }

      case "svg": {
        const SVG_MAX_SIZE_BYTES = 1 * 1024 * 1024;
        if (stat.size > SVG_MAX_SIZE_BYTES) {
          return {
            llmContent: `Cannot display content of SVG file larger than 1MB: ${relativePathForDisplay}`,
            returnDisplay: `Skipped large SVG file (>1MB): ${relativePathForDisplay}`,
          };
        }
        const content = await fs.promises.readFile(absPath, "utf8");
        return {
          llmContent: content,
          returnDisplay: `Read SVG as text: ${relativePathForDisplay}`,
        };
      }

      case "text": {
        const content = await fs.promises.readFile(absPath, "utf8");
        const lines = content.split("\n");
        const originalLineCount = lines.length;

        const startLine = offset || 0;
        const defaultMax = options?.defaultMaxLines ?? DEFAULT_MAX_LINES_TEXT_FILE;
        const effectiveLimit = limit === undefined ? defaultMax : limit;
        const endLine = Math.min(startLine + effectiveLimit, originalLineCount);
        const actualStartLine = Math.min(startLine, originalLineCount);
        const selectedLines = lines.slice(actualStartLine, endLine);

        let linesWereTruncatedInLength = false;
        const formattedLines = selectedLines.map((line) => {
          const maxLen = options?.maxLineLength ?? MAX_LINE_LENGTH_TEXT_FILE;
          if (line.length > maxLen) {
            linesWereTruncatedInLength = true;
            return line.substring(0, maxLen) + "... [truncated]";
          }
          return line;
        });

        const contentRangeTruncated = startLine > 0 || endLine < originalLineCount;
        const isTruncated = contentRangeTruncated || linesWereTruncatedInLength;
        const llmContent = formattedLines.join("\n");

        let returnDisplay = "";
        if (contentRangeTruncated) {
          returnDisplay = `Read lines ${actualStartLine + 1}-${endLine} of ${originalLineCount} from ${relativePathForDisplay}`;
          if (linesWereTruncatedInLength) {
            returnDisplay += " (some lines were shortened)";
          }
        } else if (linesWereTruncatedInLength) {
          returnDisplay = `Read all ${originalLineCount} lines from ${relativePathForDisplay} (some lines were shortened)`;
        }

        return {
          llmContent,
          returnDisplay,
          isTruncated,
          originalLineCount,
          linesShown: [actualStartLine + 1, endLine],
        };
      }

      case "image":
      case "pdf":
      case "audio":
      case "video": {
        const bytes: Uint8Array = await fs.promises.readFile(absPath);
        const base64Data = toBase64(bytes);
        return {
          llmContent: {
            inlineData: {
              data: base64Data,
              mimeType: getSpecificMimeType(normalizedFilePath) || "application/octet-stream",
            },
          },
          returnDisplay: `Read ${fileType} file: ${relativePathForDisplay}`,
        };
      }

      default: {
        // Should not happen with current detectFileType logic
        const exhaustiveCheck: never = fileType;
        return {
          llmContent: `Unhandled file type: ${exhaustiveCheck}`,
          returnDisplay: `Skipped unhandled file type: ${relativePathForDisplay}`,
          error: `Unhandled file type for ${normalizedFilePath}`,
        };
      }
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const displayPath = toPosix(relativePosix(normalizedRootPath, normalizedFilePath));
    let errorType: ErrorType | undefined = ErrorType.READ_CONTENT_FAILURE;

    // Map some DOMException names to existing error types for parity with Node version
    if (error?.name === "NotFoundError") errorType = ErrorType.FILE_NOT_FOUND;
    else if (error?.name === "TypeMismatchError") errorType = ErrorType.TARGET_IS_DIRECTORY;
    else if (error?.name === "SecurityError") errorType = ErrorType.READ_CONTENT_FAILURE;

    return {
      llmContent: `Error reading file ${displayPath}: ${errorMessage}`,
      returnDisplay: `Error reading file ${displayPath}: ${errorMessage}`,
      error: `Error reading file ${normalizedFilePath}: ${errorMessage}`,
      errorType,
    };
  }
}
