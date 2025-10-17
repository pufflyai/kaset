import type { Loader } from "esbuild-wasm";

export const ensureLeadingSlash = (value: string) => (value.startsWith("/") ? value : `/${value}`);

const stripQueryAndHash = (path: string) => path.replace(/[?#].*$/, "");

export const loaderFromPath = (path: string): Loader => {
  const sanitized = stripQueryAndHash(path);
  if (sanitized.endsWith(".ts")) return "ts";
  if (sanitized.endsWith(".tsx")) return "tsx";
  if (sanitized.endsWith(".js")) return "js";
  if (sanitized.endsWith(".mjs")) return "js";
  if (sanitized.endsWith(".jsx")) return "jsx";
  if (sanitized.endsWith(".json")) return "json";
  if (sanitized.endsWith(".css")) return "css";
  return "js";
};

export const isHttpUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

export const joinPath = (base: string, segment: string) => {
  if (segment.startsWith("/")) return ensureLeadingSlash(segment);

  const importerUrl = new URL(base, "https://kaset.virtual");
  const resolved = new URL(segment, importerUrl);

  return ensureLeadingSlash(resolved.pathname);
};
