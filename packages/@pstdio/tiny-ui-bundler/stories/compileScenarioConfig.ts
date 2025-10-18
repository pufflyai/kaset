import type { BuildWithEsbuildOptions, CompileResult } from "../src/esbuild/types";
import type { Scenario, SnapshotVariant } from "./compileScenarioShared";

export const SCENARIO_LABELS: Record<Scenario, string> = {
  fresh: "Fresh compile",
  cacheHit: "Cache hit",
  skipCache: "Skip cache flag",
  sourceChanged: "Source change",
};

export const SCENARIO_DESCRIPTIONS: Record<Scenario, string> = {
  fresh: "Runs compile once with a clean cache to demonstrate a cold build.",
  cacheHit: "Runs compile twice without changing the snapshot to surface the cache hit behaviour.",
  skipCache: "Primes the cache and then forces a rebuild using skipCache to bypass manifest lookups.",
  sourceChanged: "Regenerates the snapshot with different source contents so the hash changes and the cache misses.",
};

export const SCENARIO_STORY_DESCRIPTIONS: Record<Scenario, string> = {
  fresh: "Demonstrates a cold bundle compile with an empty manifest cache.",
  cacheHit: "Shows the second compile resolving from the cache manifest without invoking esbuild again.",
  skipCache: "Forces a recompilation by passing skipCache even though a matching bundle already exits in the manifest.",
  sourceChanged:
    "Updates the virtual snapshot before the second compile to demonstrate cache invalidation when sources change.",
};

export const COMPONENT_DESCRIPTION =
  "Stories that exercise the Tiny UI bundler compile pipeline and visualise the caching behaviour under different scenarios.";

export type ScenarioContext = {
  recordCompile: (label: string, options?: Partial<BuildWithEsbuildOptions>) => Promise<CompileResult>;
  updateSnapshot: (variant: SnapshotVariant) => void;
};

export const SCENARIO_RUNNERS: Record<Scenario, (context: ScenarioContext) => Promise<void>> = {
  fresh: async ({ recordCompile }) => {
    await recordCompile("Initial compile");
  },
  cacheHit: async ({ recordCompile }) => {
    await recordCompile("Initial compile");
    await recordCompile("Second compile (expected cache hit)");
  },
  skipCache: async ({ recordCompile }) => {
    await recordCompile("Initial compile");
    await recordCompile("Recompile with skipCache", { skipCache: true });
  },
  sourceChanged: async ({ recordCompile, updateSnapshot }) => {
    await recordCompile("Initial compile");
    updateSnapshot("updated");
    await recordCompile("Compile after source change");
  },
};

export type { Scenario } from "./compileScenarioShared";
