import type { Meta, StoryObj } from "@storybook/react";
import debounce from "lodash.debounce";
import type { ChangeEvent, CSSProperties } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CACHE_NAME } from "../src/constant";
import { setLockfile } from "../src/core/idb";
import type { CompileResult } from "../src/esbuild/types";
import { TinyUI, type TinyUIHandle } from "../src/react/tiny-ui";
import { TinyUIStatus } from "../src/react/types";

import { now, normalizeRoot, writeSnapshotFiles } from "./files/helpers";
import CHAKRA_ENTRY_SOURCE from "./files/SharedTheme/index.tsx?raw";

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

const ENTRY_PATH = "/index.tsx";
const SNAPSHOT_ROOTS = [CHAKRA_ROOT_A, CHAKRA_ROOT_B] as const;
const SNAPSHOT_WRITE_QUEUES = new Map<string, Promise<void>>();

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

const enqueueSnapshotWrite = (root: string, tokensCss: string) => {
  const folder = normalizeRoot(root);

  const previous = SNAPSHOT_WRITE_QUEUES.get(folder) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() =>
      writeSnapshotFiles(folder, ENTRY_PATH, {
        "index.tsx": CHAKRA_ENTRY_SOURCE,
        "tokens.css": tokensCss,
      }),
    );

  SNAPSHOT_WRITE_QUEUES.set(folder, next);
  return next;
};

const syncChakraSnapshots = (tokens: SharedThemeTokens) => {
  const tokensCss = createTokensCss(tokens);
  return Promise.all(SNAPSHOT_ROOTS.map((root) => enqueueSnapshotWrite(root, tokensCss))).then(() => undefined);
};

const TOKEN_CONTROLS: Array<{ key: keyof SharedThemeTokens; label: string }> = [
  { key: "surface", label: "Surface" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "brand50", label: "Brand · 50" },
  { key: "brand100", label: "Brand · 100" },
  { key: "brand500", label: "Brand · 500" },
  { key: "brand600", label: "Brand · 600" },
];

const SharedThemeDemo = () => {
  const [tokens, setTokens] = useState<SharedThemeTokens>(() => ({ ...DEFAULT_TOKENS }));
  const [statusA, setStatusA] = useState<TinyUIStatus>("initializing");
  const [statusB, setStatusB] = useState<TinyUIStatus>("initializing");
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const tinyARef = useRef<TinyUIHandle | null>(null);
  const tinyBRef = useRef<TinyUIHandle | null>(null);
  const firstSyncRef = useRef(true);

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, []);

  const setTokenValue = useMemo(
    () =>
      debounce((key: keyof SharedThemeTokens, value: string) => {
        setTokens((previous) => {
          if (previous[key] === value) return previous;

          return { ...previous, [key]: value };
        });
      }, 120),
    [setTokens],
  );

  useEffect(() => {
    return () => {
      setTokenValue.cancel();
    };
  }, [setTokenValue]);

  const handleTokenChange = useCallback(
    (key: keyof SharedThemeTokens) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setTokenValue(key, value);
    },
    [setTokenValue],
  );

  useEffect(() => {
    let cancelled = false;
    const isFirstSync = firstSyncRef.current;
    firstSyncRef.current = false;

    if (!isFirstSync) {
      setStatusA("initializing");
      setStatusB("initializing");
    }

    setMessage(isFirstSync ? "Loading Chakra UI sources into OPFS..." : "Updating shared theme tokens...");

    syncChakraSnapshots(tokens)
      .then(() => {
        if (cancelled) return;

        if (isFirstSync) {
          setInitialized(true);
          setStatusA("idle");
          setStatusB("idle");
          setMessage("Chakra UI sources loaded. Ready to compile.");
          return;
        }

        setMessage("Shared theme tokens updated. Rebuilding...");

        const rebuild = (handle: TinyUIHandle | null, setStatus: (next: TinyUIStatus) => void) => {
          if (!handle) return;

          handle.rebuild().catch((error) => {
            const normalized = error instanceof Error ? error : new Error("Failed to rebuild Tiny UI instance.");
            setStatus("error");
            setMessage(normalized.message);
          });
        };

        rebuild(tinyARef.current, setStatusA);
        rebuild(tinyBRef.current, setStatusB);
      })
      .catch((cause) => {
        if (cancelled) return;

        const normalized = cause instanceof Error ? cause : new Error("Failed to sync shared theme tokens into OPFS.");
        setStatusA("error");
        setStatusB("error");
        setMessage(normalized.message);
      });

    return () => {
      cancelled = true;
    };
  }, [tokens]);

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
        {initialized ? (
          <>
            <TinyUI
              ref={tinyARef}
              root={CHAKRA_ROOT_A}
              id={SOURCE_ID_A}
              autoCompile
              serviceWorkerUrl="/tiny-ui-sw.js"
              onStatusChange={onStatusChangeA}
              onReady={onReady}
              onError={onError}
              style={frameStyle}
            />
            <TinyUI
              ref={tinyBRef}
              root={CHAKRA_ROOT_B}
              id={SOURCE_ID_B}
              autoCompile
              serviceWorkerUrl="/tiny-ui-sw.js"
              onStatusChange={onStatusChangeB}
              onReady={onReady}
              onError={onError}
              style={frameStyle}
            />
          </>
        ) : (
          <>
            <div
              aria-busy="true"
              style={{
                ...frameStyle,
                borderRadius: 12,
                border: "1px dashed #475569",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
              }}
            >
              Loading Chakra UI sources...
            </div>
            <div
              aria-busy="true"
              style={{
                ...frameStyle,
                borderRadius: 12,
                border: "1px dashed #475569",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
              }}
            >
              Loading Chakra UI sources...
            </div>
          </>
        )}
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
