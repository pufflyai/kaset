import { useCallback, useEffect, useMemo, useState } from "react";

import { compile, getCachedBundle, getStats, setLockfile } from "../src";
import { getVirtualPrefix } from "../src/constants";
import { registerVirtualSnapshot } from "../src/core/snapshot";
import { registerSources } from "../src/core/sources";
import type { BuildWithEsbuildOptions } from "../src/esbuild/types";

import esbuildWasmUrl from "esbuild-wasm/esbuild.wasm?url";

import { SCENARIO_DESCRIPTIONS, SCENARIO_LABELS, SCENARIO_RUNNERS, type Scenario } from "./compileScenarioConfig";
import {
  ensureServiceWorkerRegistered,
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

export const CompileScenarioStory = ({ scenario, snapshotId }: CompileScenarioProps) => {
  const [state, setState] = useState<ScenarioState>(INITIAL_STATE);
  const [runRequest, setRunRequest] = useState<{ id: number; scenario: Scenario } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

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
    setState(INITIAL_STATE);
    setRunRequest(null);
  }, [scenario, activeSnapshotId]);

  useEffect(() => {
    if (!runRequest || runRequest.scenario !== scenario) return;

    let cancelled = false;

    const setWorkingState = (status: "preparing" | "running") => {
      setState({
        status,
        steps: [],
        cachedBundle: null,
        stats: null,
        error: null,
      });
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
        setState({
          status: "error",
          steps: [...steps],
          cachedBundle: null,
          stats: null,
          error: normalized.message,
        });
        setRunRequest(null);
        return;
      }

      const cachedBundle = await getCachedBundle(SOURCE_ID);
      const stats = getStats();

      if (cancelled) return;

      setState({
        status: "ready",
        steps,
        cachedBundle,
        stats,
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

    try {
      await resetCompileArtifacts();
      await resetServiceWorker();
      await ensureServiceWorkerRegistered();
    } finally {
      setIsResetting(false);
    }
  }, [isResetting]);

  const isBusy = state.status === "running" || state.status === "preparing";
  const hasTiming = state.steps.length > 0;
  const totalDurationMs = hasTiming ? state.steps.reduce((total, step) => total + step.durationMs, 0) : 0;
  const averageDurationMs = hasTiming ? totalDurationMs / state.steps.length : 0;
  const fastestDurationMs = hasTiming ? Math.min(...state.steps.map((step) => step.durationMs)) : 0;
  const slowestDurationMs = hasTiming ? Math.max(...state.steps.map((step) => step.durationMs)) : 0;

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

      <section style={{ border: "1px solid #cbd5f5", borderRadius: 12, padding: 12 }}>
        <h4 style={{ margin: "0 0 8px" }}>Stats snapshot</h4>
        {state.stats ? (
          <pre
            style={{
              margin: 0,
              padding: 12,
              background: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 8,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(state.stats, null, 2)}
          </pre>
        ) : (
          <p style={{ margin: 0 }}>Stats are unavailable while the scenario runs.</p>
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
