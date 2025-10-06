import type { Meta, StoryObj } from "@storybook/react";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CACHE_NAME } from "../constant.js";
import { setLockfile } from "../src/core/idb.js";
import type { CompileResult } from "../src/esbuild/types.js";
import { registerVirtualSnapshot } from "../src/opfs/snapshot.js";
import { TinyUI, type TinyUIHandle, type TinyUIStatus } from "../src/react/tiny-ui.js";

/** Virtual source roots for two MFEs that will share the same tokens */
const CHAKRA_ROOT_A = "/stories/tiny-chakra/a";
const CHAKRA_ROOT_B = "/stories/tiny-chakra/b";
const SOURCE_ID_A = "tiny-ui-chakra-a";
const SOURCE_ID_B = "tiny-ui-chakra-b";

/** Resolve Chakra + peers from esm.sh (works with the tiny-ui remote plugin) */
const LOCKFILE = {
  react: "https://esm.sh/react@18.3.1/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@18.3.1/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@18.3.1/es2022/client.mjs",

  "@chakra-ui/react": "https://esm.sh/@chakra-ui/react@2.8.2?deps=react@18.3.1,react-dom@18.3.1",
  "@emotion/react": "https://esm.sh/@emotion/react@11.13.0?deps=react@18.3.1",
  "@emotion/styled": "https://esm.sh/@emotion/styled@11.13.0?deps=react@18.3.1",
  "framer-motion": "https://esm.sh/framer-motion@11.0.3?deps=react@18.3.1,react-dom@18.3.1",
} as const;

/** ---------------------------
 *  Virtual sources (the MFE)
 *  ---------------------------
 *  - index.tsx: Chakra UI mount + theme mapping CSS vars to colors.brand
 *  - tokens.css: default tokens (can be overridden at runtime)
 */

const CHAKRA_ENTRY = String.raw`import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, Box, Button, extendTheme, Text, VStack } from "@chakra-ui/react";
import "./tokens.css";

const theme = extendTheme({
  colors: {
    brand: {
      50: "var(--brand-50, #eef2ff)",
      100: "var(--brand-100, #e0e7ff)",
      500: "var(--brand-500, #6366f1)",
      600: "var(--brand-600, #4f46e5)",
    },
  },
  radii: {
    lg: "var(--radius-lg, 12px)",
  },
});

function App() {
  return (
    <Box bg="var(--surface, #0f172a)" color="var(--text, #e2e8f0)" p={6} rounded="lg">
      <VStack align="stretch" spacing={4}>
        <Text as="h2" fontSize="xl" fontWeight="bold" m={0}>
          Shared Theme · Chakra UI
        </Text>
        <Text color="var(--muted, #94a3b8)">
          Tokens come from CSS custom properties shared by the host.
        </Text>
        <Button colorScheme="brand" size="md">
          Brand Button
        </Button>
      </VStack>
    </Box>
  );
}

export function mount(container: HTMLElement) {
  container.innerHTML = "";
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </StrictMode>,
  );
  return () => root.unmount();
}
`;

type SharedThemeTokens = {
  surface: string;
  text: string;
  muted: string;
  brand50: string;
  brand100: string;
  brand500: string;
  brand600: string;
};

const DEFAULT_TOKENS: SharedThemeTokens = {
  surface: "#0f172a",
  text: "#e2e8f0",
  muted: "#94a3b8",
  brand50: "#eef2ff",
  brand100: "#e0e7ff",
  brand500: "#6366f1",
  brand600: "#4f46e5",
};

const createTokensCss = (tokens: SharedThemeTokens) =>
  String.raw`:root {
  /* Surface & text */
  --surface: ${tokens.surface};
  --text: ${tokens.text};
  --muted: ${tokens.muted};

  /* Shape */
  --radius-lg: 12px;

  /* Brand scale */
  --brand-50: ${tokens.brand50};
  --brand-100: ${tokens.brand100};
  --brand-500: ${tokens.brand500};
  --brand-600: ${tokens.brand600};
}
`;

const SHARED_TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      jsx: "react-jsx",
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      allowSyntheticDefaultImports: true,
    },
  },
  null,
  2,
);

const registerChakraSnapshots = (tokens: SharedThemeTokens) => {
  const tokensCss = createTokensCss(tokens);

  const buildSnapshot = () => ({
    entry: "/index.tsx",
    tsconfig: SHARED_TSCONFIG,
    files: {
      "/index.tsx": CHAKRA_ENTRY,
      "/tokens.css": tokensCss,
    },
  });

  registerVirtualSnapshot(CHAKRA_ROOT_A, buildSnapshot());
  registerVirtualSnapshot(CHAKRA_ROOT_B, buildSnapshot());
};

/** Register two virtual workspaces that share the same sources */
registerChakraSnapshots(DEFAULT_TOKENS);

/** ---------------------------
 *  The Story component (host)
 *  ---------------------------
 */

const TOKEN_CONTROLS: Array<{ key: keyof SharedThemeTokens; label: string }> = [
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "brand50", label: "Brand · 50" },
  { key: "brand100", label: "Brand · 100" },
  { key: "brand500", label: "Brand · 500" },
  { key: "brand600", label: "Brand · 600" },
];

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const SharedThemeDemo = () => {
  const [tokens, setTokens] = useState<SharedThemeTokens>(() => ({ ...DEFAULT_TOKENS }));
  const [statusA, setStatusA] = useState<TinyUIStatus>("idle");
  const [statusB, setStatusB] = useState<TinyUIStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const tinyARef = useRef<TinyUIHandle | null>(null);
  const tinyBRef = useRef<TinyUIHandle | null>(null);

  useLayoutEffect(() => {
    // Make Chakra/React available to the builder + runtime via the lockfile.
    setLockfile(LOCKFILE);
  }, []);

  const rebuildSharedBundles = useCallback(
    (nextTokens: SharedThemeTokens) => {
      registerChakraSnapshots(nextTokens);

      setMessage("Updating shared theme tokens...");

      const handles = [tinyARef.current, tinyBRef.current];
      handles.forEach((handle) => {
        handle?.rebuild().catch((error) => {
          console.error("Failed to rebuild Tiny UI instance", error);
        });
      });
    },
    [setMessage],
  );

  const handleTokenChange = useCallback(
    (key: keyof SharedThemeTokens) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setTokens((previous) => {
        const next = { ...previous, [key]: value };
        rebuildSharedBundles(next);
        return next;
      });
    },
    [rebuildSharedBundles],
  );

  const containerStyle = useMemo<CSSProperties>(
    () => ({
      display: "grid",
      gap: 12,
      maxWidth: 980,
      "--surface": tokens.surface,
      "--text": tokens.text,
      "--muted": tokens.muted,
      "--brand-50": tokens.brand50,
      "--brand-100": tokens.brand100,
      "--brand-500": tokens.brand500,
      "--brand-600": tokens.brand600,
    }),
    [tokens],
  );

  const frameStyle = useMemo<CSSProperties>(
    () => ({
      minHeight: 240,
      display: "flex",
      alignItems: "stretch",
    }),
    [tokens.surface],
  );

  const onStatusChangeA = useCallback((s: TinyUIStatus) => {
    setStatusA(s);
    if (s === "compiling") {
      startedAtRef.current = now();
      setMessage("Compiling Chakra bundle(s)...");
    }
  }, []);
  const onStatusChangeB = useCallback((s: TinyUIStatus) => setStatusB(s), []);

  const onReady = useCallback((result: CompileResult) => {
    const t0 = startedAtRef.current;
    startedAtRef.current = null;
    const dt = typeof t0 === "number" ? Math.max(0, Math.round(now() - t0)) : null;
    const timing = dt !== null ? ` in ${dt}ms` : "";
    const cache = result.fromCache ? " (from cache)" : "";
    setMessage(`Bundles ready${timing}${cache}.`);
  }, []);

  const onError = useCallback((err: Error) => {
    startedAtRef.current = null;
    console.log(err);
    // setStatusA("error");
    // setStatusB("error");
    // setMessage(err.message);
  }, []);

  const clearCache = useCallback(async () => {
    if (typeof caches === "undefined") return;
    setMessage("Clearing bundle cache...");
    await caches.delete(CACHE_NAME);
    setStatusA("idle");
    setStatusB("idle");
    setMessage("Cache cleared. Rebuild to compile again.");
  }, []);

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={clearCache} type="button">
          Clear Cache
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        }}
      >
        {TOKEN_CONTROLS.map(({ key, label }) => (
          <label key={key} style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 500 }}>
            <span>{label}</span>
            <input
              type="color"
              value={tokens[key]}
              onChange={handleTokenChange(key)}
              style={{
                width: "100%",
                minHeight: 38,
                border: "1px solid rgba(148, 163, 184, 0.35)",
                borderRadius: 8,
                padding: 0,
                background: "transparent",
              }}
            />
            <span style={{ fontFamily: "monospace", fontSize: 11 }}>{tokens[key]}</span>
          </label>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <TinyUI
          ref={tinyARef}
          src={CHAKRA_ROOT_A}
          id={SOURCE_ID_A}
          autoCompile
          onStatusChange={onStatusChangeA}
          onReady={onReady}
          onError={onError}
          style={frameStyle}
        />
        <TinyUI
          ref={tinyBRef}
          src={CHAKRA_ROOT_B}
          id={SOURCE_ID_B}
          autoCompile
          onStatusChange={onStatusChangeB}
          onReady={onReady}
          onError={onError}
          style={frameStyle}
        />
      </div>

      <div aria-live="polite">
        <strong>Status A:</strong> {statusA} &nbsp; | &nbsp; <strong>Status B:</strong> {statusB}
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
};

const meta: Meta<typeof SharedThemeDemo> = {
  title: "Tiny UI/Shared Theme (Chakra)",
  component: SharedThemeDemo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: "Two iframes render Chakra UI and share the same CSS-variable tokens provided by the host.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof SharedThemeDemo>;
export const Playground: Story = {};
