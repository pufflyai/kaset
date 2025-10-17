import { useCallback, useEffect, useMemo, useState } from "react";

import { compile, getCachedBundle, setLockfile } from "../src";
import { getVirtualPrefix } from "../src/constants";
import { registerVirtualSnapshot } from "../src/core/snapshot";
import { registerSources } from "../src/core/sources";
import type { BuildWithEsbuildOptions } from "../src/esbuild/types";
import type { CompileResult } from "../src/esbuild/types";

import esbuildWasmUrl from "esbuild-wasm/esbuild.wasm?url";

import { SCENARIO_DESCRIPTIONS, SCENARIO_LABELS, SCENARIO_RUNNERS, type Scenario } from "./compileScenarioConfig";
import {
  ensureServiceWorkerRegistered,
  listHostedBundles,
  resetCompileArtifacts,
  resetServiceWorker,
  verifyBundleAccessibility,
} from "./compileScenarioEnvironment";
import { ENTRY_PATH, SOURCE_ID, STORY_ROOT, type SnapshotVariant } from "./compileScenarioShared";
import {
  describeAccessibility,
  formatDuration,
  INITIAL_STATE,
  now,
  type CompileStep,
  type ScenarioState,
} from "./compileScenarioState";
import { DEFAULT_SNAPSHOT_ID, getSnapshotDefinition, type SnapshotId } from "./snapshots";

const buildAssetUrl = (hash: string, assetPath: string) => {
  const prefix = getVirtualPrefix();
  const normalized = assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  return `${prefix}${hash}/${normalized}`;
};

const renderAssetList = (hash: string, assets: string[]) => {
  if (assets.length === 0) return "None";

  return (
    <ul
      style={{
        margin: 0,
        paddingLeft: 18,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {assets.map((asset) => {
        const assetUrl = buildAssetUrl(hash, asset);
        return (
          <li key={`${hash}-${asset}`} style={{ overflowWrap: "anywhere" }}>
            <a href={assetUrl} target="_blank" rel="noopener noreferrer">
              {assetUrl}
            </a>
          </li>
        );
      })}
    </ul>
  );
};

export interface CompileScenarioProps {
  scenario: Scenario;
  snapshotId?: SnapshotId;
}

const createPreviewHtml = (params: { bundle: CompileResult; entrySource: string; styles: string[] }) => {
  const { bundle, entrySource, styles } = params;
  if (typeof window === "undefined") return "";

  const baseHref = new URL(".", window.location.href).toString();
  const moduleSourceJson = JSON.stringify(entrySource);
  const stylesJson = JSON.stringify(styles);

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <base href="${baseHref}">
    <style>
      :root {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #0f172a;
      }

      body {
        margin: 0;
        padding: 16px;
        background: #f8fafc;
      }

      #root {
        min-height: 200px;
        background: #ffffff;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
        padding: 16px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .loading {
        color: #64748b;
      }

      .error {
        color: #b91c1c;
      }
    </style>
  </head>
  <body>
    <div id="root" class="loading">Loading bundle ${bundle.hash}…</div>
    <script type="module">
      const root = document.getElementById("root");
      const styleSources = ${stylesJson};
      const moduleSource = ${moduleSourceJson};
      const describeFns = ["describeBundle", "describeCounter", "describeLatencyWidget", "describeBundleSummary"];
      const mountFns = ["mount", "mountLatencyWidget", "render", "boot"];

      const resetRoot = () => {
        if (!root) return;
        root.className = "";
        root.textContent = "";
      };

      const setStatus = (text, className = "") => {
        if (!root) return;
        root.className = className;
        root.textContent = text;
      };

      const callWithTarget = async (fn) => {
        if (typeof fn !== "function") return;
        if (!root) return fn();
        try {
          switch (fn.length) {
            case 0:
              return fn();
            case 1:
              return fn(root);
            case 2:
              return fn(root, {});
            default:
              return fn(root);
          }
        } catch (error) {
          throw error;
        }
      };

      const injectStyles = (sources) => {
        if (!Array.isArray(sources) || sources.length === 0) return;
        for (const css of sources) {
          if (typeof css !== "string" || !css.trim()) continue;
          const styleEl = document.createElement("style");
          styleEl.type = "text/css";
          styleEl.textContent = css;
          document.head.appendChild(styleEl);
        }
      };

      async function renderBundle() {
        if (!root) return;

        let moduleUrl;

        try {
          injectStyles(styleSources);

          const moduleBlob = new Blob([moduleSource], { type: "text/javascript" });
          moduleUrl = URL.createObjectURL(moduleBlob);

          const mod = await import(moduleUrl);
          console.info("[Tiny UI Bundler] Preview module", mod);

          for (const name of mountFns) {
            const candidate = mod?.[name];
            if (typeof candidate === "function") {
              resetRoot();
              const result = await callWithTarget(candidate);
              if (typeof result === "string") {
                setStatus(result);
              } else if (result instanceof HTMLElement) {
                root.innerHTML = "";
                root.appendChild(result);
              } else if (!root.hasChildNodes()) {
                setStatus(\`Mounted \${name}()\`);
              }
              return;
            }
          }

          if (typeof mod.init === "function") {
            resetRoot();
            const result = await callWithTarget(mod.init);
            if (typeof result === "string") {
              setStatus(result);
            } else if (result instanceof HTMLElement) {
              root.innerHTML = "";
              root.appendChild(result);
            } else if (!root.hasChildNodes()) {
              setStatus("init() executed.");
            }
            return;
          }

          if (typeof mod.default === "function") {
            resetRoot();
            const output = await callWithTarget(mod.default);
            if (typeof output === "string") {
              setStatus(output);
            } else if (output instanceof HTMLElement) {
              root.innerHTML = "";
              root.appendChild(output);
            } else if (!root.hasChildNodes()) {
              setStatus("Default export executed.");
            }
            return;
          }

          for (const name of describeFns) {
            const candidate = mod?.[name];
            if (typeof candidate === "function") {
              const value = candidate();
              setStatus(String(value ?? ""));
              return;
            }
          }

          const exportNames = mod ? Object.keys(mod) : [];
          setStatus(exportNames.length > 0 ? \`Bundle loaded. Exports: \${exportNames.join(", ")}\` : "Bundle executed.");
        } catch (error) {
          console.error("[Tiny UI Bundler] Preview failed", error);
          setStatus("Failed to load bundle: " + (error?.message ?? error), "error");
        } finally {
          if (moduleUrl) {
            try {
              URL.revokeObjectURL(moduleUrl);
            } catch (revokeError) {
              console.warn("[Tiny UI Bundler] Failed to revoke preview module URL", revokeError);
            }
          }
        }
      }

      renderBundle();
    </script>
  </body>
</html>
`;
};

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const createPreviewErrorHtml = (hash: string, message: string) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        height: 100%;
      }
      body {
        margin: 0;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        color: #b91c1c;
      }
      .box {
        max-width: 90%;
        border-radius: 12px;
        border: 1px solid #fecaca;
        background: #fee2e2;
        padding: 16px;
        text-align: center;
      }
      h1 {
        font-size: 16px;
        margin: 0 0 8px;
      }
      p {
        margin: 0;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Failed to preview bundle ${hash}</h1>
      <p>${escapeHtml(message)}</p>
    </div>
  </body>
</html>
`;

export const CompileScenarioStory = ({ scenario, snapshotId }: CompileScenarioProps) => {
  const [state, setState] = useState<ScenarioState>(INITIAL_STATE);
  const [runRequest, setRunRequest] = useState<{ id: number; scenario: Scenario } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const activeSnapshotId = snapshotId ?? DEFAULT_SNAPSHOT_ID;

  const snapshotDefinition = useMemo(() => getSnapshotDefinition(activeSnapshotId), [activeSnapshotId]);

  const summary = useMemo(
    () => ({
      label: SCENARIO_LABELS[scenario],
      description: SCENARIO_DESCRIPTIONS[scenario],
      snapshotLabel: snapshotDefinition.label,
      snapshotDescription: snapshotDefinition.description,
    }),
    [scenario, snapshotDefinition],
  );

  useEffect(() => {
    setState((prev) => ({
      status: "ready",
      steps: [],
      cachedBundle: null,
      hostedBundles: prev.hostedBundles,
      error: null,
    }));
    setRunRequest(null);
  }, [scenario, activeSnapshotId]);

  useEffect(() => {
    let cancelled = false;

    const refreshHostedBundles = async () => {
      const bundles = await listHostedBundles();
      if (cancelled) return;

      setState((prev) => ({
        ...prev,
        hostedBundles: bundles,
      }));
    };

    refreshHostedBundles();

    return () => {
      cancelled = true;
    };
  }, [scenario, activeSnapshotId]);

  useEffect(() => {
    if (!runRequest || runRequest.scenario !== scenario) return;

    let cancelled = false;

    const setWorkingState = (status: "preparing" | "running") => {
      setState((prev) => ({
        status,
        steps: [],
        cachedBundle: null,
        hostedBundles: prev.hostedBundles,
        error: null,
      }));
    };

    const runScenario = async () => {
      setWorkingState("preparing");

      await resetCompileArtifacts();

      if (cancelled) return;

      registerSources([{ id: SOURCE_ID, root: STORY_ROOT, entry: `${STORY_ROOT}${ENTRY_PATH}` }]);

      setWorkingState("running");

      const steps: CompileStep[] = [];

      const recordCompile = async (label: string, options?: Partial<BuildWithEsbuildOptions>) => {
        const startedAt = now();
        const result = await compile(SOURCE_ID, {
          wasmURL: esbuildWasmUrl,
          ...options,
        });
        const finishedAt = now();

        const accessibility = await verifyBundleAccessibility(result);

        steps.push({
          label,
          result,
          accessibility,
          durationMs: finishedAt - startedAt,
        });
        return result;
      };

      const updateSnapshot = (variant: SnapshotVariant) => {
        setLockfile(snapshotDefinition.lockfile ?? null);
        registerVirtualSnapshot(STORY_ROOT, snapshotDefinition.build(variant));
      };

      updateSnapshot("fresh");

      try {
        await SCENARIO_RUNNERS[scenario]({ recordCompile, updateSnapshot });
      } catch (error) {
        if (cancelled) return;

        const normalized = error instanceof Error ? error : new Error("Compile failed");
        setState((prev) => ({
          status: "error",
          steps: [...steps],
          cachedBundle: null,
          hostedBundles: prev.hostedBundles,
          error: normalized.message,
        }));
        setRunRequest(null);
        return;
      }

      const cachedBundle = await getCachedBundle(SOURCE_ID);
      const hostedBundles = await listHostedBundles();

      if (cancelled) return;

      setState({
        status: "ready",
        steps,
        cachedBundle,
        hostedBundles,
        error: null,
      });

      setRunRequest(null);
    };

    runScenario();

    return () => {
      cancelled = true;
    };
  }, [runRequest, scenario, snapshotDefinition]);

  const handleRunScenario = useCallback(() => {
    setRunRequest({ id: Date.now(), scenario });
  }, [scenario]);

  const handleResetEnvironment = useCallback(async () => {
    if (isResetting) return;

    setIsResetting(true);
    setRunRequest(null);
    setState(INITIAL_STATE);
    setPreviewDoc(null);
    setPreviewError(null);
    setPreviewLoading(false);

    let hostedBundles: ScenarioState["hostedBundles"] = [];

    try {
      await resetCompileArtifacts();
      await resetServiceWorker();
      await ensureServiceWorkerRegistered();
      hostedBundles = await listHostedBundles();
    } catch (error) {
      console.warn("[Tiny UI Bundler] Failed to reset environment completely", error);
    } finally {
      setState({
        status: "ready",
        steps: [],
        cachedBundle: null,
        hostedBundles,
        error: null,
      });
      setIsResetting(false);
    }
  }, [isResetting]);

  const isBusy = state.status === "running" || state.status === "preparing";
  const hasTiming = state.steps.length > 0;
  const totalDurationMs = hasTiming ? state.steps.reduce((total, step) => total + step.durationMs, 0) : 0;
  const averageDurationMs = hasTiming ? totalDurationMs / state.steps.length : 0;
  const fastestDurationMs = hasTiming ? Math.min(...state.steps.map((step) => step.durationMs)) : 0;
  const slowestDurationMs = hasTiming ? Math.max(...state.steps.map((step) => step.durationMs)) : 0;
  const previewBundle = useMemo(
    () => state.cachedBundle ?? (state.steps.length > 0 ? state.steps[state.steps.length - 1].result : null),
    [state.cachedBundle, state.steps],
  );
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    const preparePreview = async () => {
      if (!previewBundle) {
        if (!cancelled) {
          setPreviewDoc(null);
          setPreviewError(null);
          setPreviewLoading(false);
        }
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewDoc(null);

      try {
        const entryResponse = await fetch(previewBundle.url, { cache: "no-cache" });
        if (!entryResponse.ok) {
          throw new Error(`Entry fetch failed (${entryResponse.status})`);
        }
        const entrySource = await entryResponse.text();

        const styleAssets = previewBundle.assets.filter((asset) => asset.endsWith(".css"));
        const styles: string[] = [];

        for (const asset of styleAssets) {
          const assetUrl = buildAssetUrl(previewBundle.hash, asset);
          const response = await fetch(assetUrl, { cache: "no-cache" });
          if (!response.ok) {
            console.warn(`[Tiny UI Bundler] Failed to fetch CSS asset ${asset} (${response.status})`);
            continue;
          }
          styles.push(await response.text());
        }

        if (cancelled) return;

        setPreviewDoc(createPreviewHtml({ bundle: previewBundle, entrySource, styles }));
        setPreviewError(null);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        setPreviewError(message);
        setPreviewDoc(createPreviewErrorHtml(previewBundle.hash, message));
      } finally {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      }
    };

    preparePreview();

    return () => {
      cancelled = true;
    };
  }, [previewBundle]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 640,
      }}
    >
      <section>
        <h3 style={{ margin: "0 0 4px" }}>{summary.label}</h3>
        <p style={{ margin: 0 }}>{summary.description}</p>
        <p style={{ margin: "8px 0 0", fontSize: 14, color: "#475569" }}>
          Snapshot: <strong>{summary.snapshotLabel}</strong>
        </p>
        {summary.snapshotDescription ? (
          <p style={{ margin: "4px 0 0", color: "#475569" }}>{summary.snapshotDescription}</p>
        ) : null}
      </section>

      <section style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={handleResetEnvironment}
          disabled={isBusy || isResetting}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #94a3b8",
            background: "#ffffff",
            cursor: isBusy || isResetting ? "not-allowed" : "pointer",
          }}
        >
          {isResetting ? "Resetting..." : "Reset cache & service worker"}
        </button>
        <button
          type="button"
          onClick={handleRunScenario}
          disabled={isBusy || isResetting}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #4338ca",
            background: isBusy ? "#c7d2fe" : "#4338ca",
            color: "#ffffff",
            cursor: isBusy || isResetting ? "not-allowed" : "pointer",
          }}
        >
          {isBusy ? "Running..." : "Run compile scenario"}
        </button>
        <span style={{ alignSelf: "center", color: "#64748b" }}>
          Run a scenario to view the bundle URL in the details below.
        </span>
      </section>

      <section aria-live="polite" style={{ padding: 12, border: "1px solid #cbd5f5", borderRadius: 12 }}>
        <strong>Status:</strong> {state.status}
        {state.error ? <p style={{ margin: "8px 0 0", color: "#b91c1c" }}>{state.error}</p> : null}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {state.steps.map((step, index) => (
          <article
            key={`${step.label}-${index}`}
            style={{ border: "1px solid #cbd5f5", borderRadius: 12, padding: 12, background: "#f8fafc" }}
          >
            <h4 style={{ margin: "0 0 8px" }}>{step.label}</h4>
            <dl
              style={{ display: "grid", width: "100%", gridTemplateColumns: "160px 1fr", gap: "6px 12px", margin: 0 }}
            >
              <dt>Bundle URL</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                <a href={step.result.url} target="_blank" rel="noopener noreferrer">
                  {step.result.url}
                </a>
              </dd>
              <dt>Hash</dt>
              <dd style={{ margin: 0 }}>{step.result.hash}</dd>
              <dt>Lockfile hash</dt>
              <dd style={{ margin: 0 }}>{step.result.lockfileHash ?? "Not recorded"}</dd>
              <dt>Bytes</dt>
              <dd style={{ margin: 0 }}>{step.result.bytes.toLocaleString()}</dd>
              <dt>Asset count</dt>
              <dd style={{ margin: 0 }}>{step.result.assets.length}</dd>
              <dt>Accessible?</dt>
              <dd style={{ margin: 0 }}>{describeAccessibility(step.accessibility)}</dd>
              <dt>Compile duration</dt>
              <dd style={{ margin: 0 }}>{formatDuration(step.durationMs)}</dd>
              <dt>Assets</dt>
              <dd style={{ margin: 0 }}>{renderAssetList(step.result.hash, step.result.assets)}</dd>
            </dl>
          </article>
        ))}
      </section>

      <section style={{ border: "1px solid #cbd5f5", borderRadius: 12, padding: 12 }}>
        <h4 style={{ margin: "0 0 8px" }}>Timings</h4>
        {hasTiming ? (
          <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "6px 12px", margin: 0 }}>
            <dt>Total compile time</dt>
            <dd style={{ margin: 0 }}>{formatDuration(totalDurationMs)}</dd>
            <dt>Average per compile</dt>
            <dd style={{ margin: 0 }}>{formatDuration(averageDurationMs)}</dd>
            <dt>Fastest compile</dt>
            <dd style={{ margin: 0 }}>{formatDuration(fastestDurationMs)}</dd>
            <dt>Slowest compile</dt>
            <dd style={{ margin: 0 }}>{formatDuration(slowestDurationMs)}</dd>
          </dl>
        ) : (
          <p style={{ margin: 0 }}>Compile timing will be available after running a scenario.</p>
        )}
      </section>

      <section style={{ border: "1px solid #cbd5f5", borderRadius: 12, padding: 12 }}>
        <h4 style={{ margin: "0 0 8px" }}>Bundle preview</h4>
        {previewBundle ? (
          previewDoc ? (
            <iframe
              key={`${previewBundle.hash}-${previewBundle.fromCache ? "cache" : "fresh"}`}
              title="Tiny UI bundle preview"
              srcDoc={previewDoc}
              sandbox="allow-scripts allow-same-origin"
              style={{
                width: "100%",
                minHeight: 260,
                border: "1px solid #cbd5f5",
                borderRadius: 12,
                background: "#f1f5f9",
              }}
            />
          ) : previewLoading ? (
            <p style={{ margin: 0 }}>Preparing bundle preview…</p>
          ) : previewError ? (
            <p style={{ margin: 0, color: "#b91c1c" }}>Failed to prepare preview: {previewError}</p>
          ) : (
            <p style={{ margin: 0 }}>Bundle preview will appear after the compile finishes.</p>
          )
        ) : (
          <p style={{ margin: 0 }}>Run a scenario to preview the compiled bundle.</p>
        )}
      </section>

      <section style={{ border: "1px solid #cbd5f5", borderRadius: 12, padding: 12 }}>
        <h4 style={{ margin: "0 0 8px" }}>Cached bundle</h4>
        {state.cachedBundle ? (
          <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "6px 12px", margin: 0 }}>
            <dt>URL</dt>
            <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
              <a href={state.cachedBundle.url} target="_blank" rel="noopener noreferrer">
                {state.cachedBundle.url}
              </a>
            </dd>
            <dt>Hash</dt>
            <dd style={{ margin: 0 }}>{state.cachedBundle.hash}</dd>
            <dt>From cache</dt>
            <dd style={{ margin: 0 }}>{state.cachedBundle.fromCache ? "Yes" : "No"}</dd>
            <dt>Bytes</dt>
            <dd style={{ margin: 0 }}>{state.cachedBundle.bytes.toLocaleString()}</dd>
            <dt>Assets</dt>
            <dd style={{ margin: 0 }}>{renderAssetList(state.cachedBundle.hash, state.cachedBundle.assets)}</dd>
          </dl>
        ) : (
          <p style={{ margin: 0 }}>No cached bundle recorded.</p>
        )}
      </section>
    </div>
  );
};

export { COMPONENT_DESCRIPTION, SCENARIO_STORY_DESCRIPTIONS } from "./compileScenarioConfig";
export type { Scenario } from "./compileScenarioConfig";
export { compileStoryHelpers } from "./compileScenarioEnvironment";
export { DEFAULT_SNAPSHOT_ID, SNAPSHOT_IDS, SNAPSHOT_LABELS, SNAPSHOT_OPTION_LIST } from "./snapshots";
export type { SnapshotId } from "./snapshots";
