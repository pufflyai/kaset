// Directory where esbuild places the generated bundles.
export const OUTPUT_DIR = "out";

// Shared base name for the generated entry bundle.
export const ENTRY_NAME = "bundle";

// Namespace used to register remote import paths in esbuild plugins.
export const REMOTE_NAMESPACE = "kaset-remote";

// Module extensions esbuild should resolve without specifying their suffix.
export const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".json", ".css"] as const;

import { resolveBasePath } from "./core/base-path";

export const CACHE_NAME = "tiny-ui-bundles-v1";

const RUNTIME_HTML_RELATIVE_PATH = "tiny-ui/runtime.html";
const VIRTUAL_RELATIVE_PREFIX = "virtual/";
const MANIFEST_RELATIVE_PATH = "tiny-ui/manifest.json";

export const getRuntimeHtmlPath = () => resolveBasePath(RUNTIME_HTML_RELATIVE_PATH);
export const getVirtualPrefix = () => resolveBasePath(VIRTUAL_RELATIVE_PREFIX);
export const getManifestUrl = () => resolveBasePath(MANIFEST_RELATIVE_PATH);

// Unified builder for entry and asset URLs within the Cache API and consumers.
export const buildVirtualUrl = (hash: string, assetPath?: string) => {
  const prefix = getVirtualPrefix();
  if (!assetPath) {
    return `${prefix}${hash}.js`;
  }

  const normalized = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return `${prefix}${hash}/${normalized}`;
};
