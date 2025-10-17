import { getStats } from "../src";
import type { CompileResult } from "../src/esbuild/types";
import type { AccessibilityCheck } from "./compileScenarioEnvironment";

export const now = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
};

export const formatDuration = (durationMs: number) => {
  if (durationMs >= 1000) {
    return `${(durationMs / 1000).toFixed(2)} s`;
  }

  return `${Math.round(durationMs)} ms`;
};

export const describeAccessibility = (check: AccessibilityCheck) => {
  if (check.status === "ok") return "Yes";
  if (check.status === "skipped") {
    return `Skipped${check.details ? ` (${check.details})` : ""}`;
  }
  if (check.status === "error") {
    return `Error${check.details ? `: ${check.details}` : ""}`;
  }
  return "Unknown";
};

export type CompileStep = {
  label: string;
  result: CompileResult;
  accessibility: AccessibilityCheck;
  durationMs: number;
};

export type StatsSnapshot = ReturnType<typeof getStats>;

export type ScenarioState =
  | {
      status: "preparing" | "running";
      steps: CompileStep[];
      cachedBundle: CompileResult | null;
      stats: StatsSnapshot | null;
      error: null;
    }
  | {
      status: "error";
      steps: CompileStep[];
      cachedBundle: CompileResult | null;
      stats: StatsSnapshot | null;
      error: string;
    }
  | {
      status: "ready";
      steps: CompileStep[];
      cachedBundle: CompileResult | null;
      stats: StatsSnapshot | null;
      error: null;
    };

export const INITIAL_STATE: ScenarioState = {
  status: "ready",
  steps: [],
  cachedBundle: null,
  stats: null,
  error: null,
};
