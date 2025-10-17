import { resolveBasePath } from "@pstdio/tiny-ui-bundler";

export const CACHE_NAME = "tiny-ui-bundles-v1";

const RUNTIME_HTML_RELATIVE_PATH = "tiny-ui/runtime.html";
const VIRTUAL_RELATIVE_PREFIX = "virtual/";
const MANIFEST_RELATIVE_PATH = "tiny-ui/manifest.json";

export const getRuntimeHtmlPath = () => resolveBasePath(RUNTIME_HTML_RELATIVE_PATH);
export const getVirtualPrefix = () => resolveBasePath(VIRTUAL_RELATIVE_PREFIX);
export const getManifestUrl = () => resolveBasePath(MANIFEST_RELATIVE_PATH);
