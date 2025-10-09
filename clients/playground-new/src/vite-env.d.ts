/// <reference types="vitest" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_DESKTOP_BACKGROUND_IMAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
