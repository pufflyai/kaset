export const STORY_ROOT = "/stories/compile-demo";
export const SOURCE_ID = "tiny-ui-bundler-demo";
export const ENTRY_PATH = "/index.ts";

export type SnapshotVariant = "fresh" | "updated";
export type Scenario = "fresh" | "cacheHit" | "skipCache" | "sourceChanged";
