// Directory where esbuild places the generated bundles.
export const OUTPUT_DIR = "out";

// Shared base name for the generated entry bundle.
export const ENTRY_NAME = "bundle";

// Namespace used to register remote import paths in esbuild plugins.
export const REMOTE_NAMESPACE = "kaset-remote";

// Module extensions esbuild should resolve without specifying their suffix.
export const RESOLVE_EXTENSIONS = ["", ".ts", ".tsx", ".js", ".jsx", ".json", ".css"] as const;
