import { analyticsSnapshot } from "./analyticsSnapshot";
import { counterSnapshot } from "./counterSnapshot";
import { defaultSnapshot } from "./defaultSnapshot";
import { reactD3Snapshot } from "./reactD3Snapshot";
import type { SnapshotDefinition } from "./types";

const registry = {
  [defaultSnapshot.id]: defaultSnapshot,
  [counterSnapshot.id]: counterSnapshot,
  [analyticsSnapshot.id]: analyticsSnapshot,
  [reactD3Snapshot.id]: reactD3Snapshot,
} as const satisfies Record<string, SnapshotDefinition>;

export type SnapshotId = keyof typeof registry;

export const SNAPSHOT_DEFINITIONS: Record<SnapshotId, SnapshotDefinition> = { ...registry };
export const DEFAULT_SNAPSHOT_ID: SnapshotId = defaultSnapshot.id;
export const SNAPSHOT_IDS = Object.keys(SNAPSHOT_DEFINITIONS) as SnapshotId[];
export const SNAPSHOT_LABELS = SNAPSHOT_IDS.reduce<Record<SnapshotId, string>>(
  (acc, id) => {
    acc[id] = SNAPSHOT_DEFINITIONS[id].label;
    return acc;
  },
  {} as Record<SnapshotId, string>,
);
export const SNAPSHOT_OPTION_LIST = SNAPSHOT_IDS.map((id) => ({
  id,
  label: SNAPSHOT_DEFINITIONS[id].label,
  description: SNAPSHOT_DEFINITIONS[id].description,
}));

export const getSnapshotDefinition = (id: SnapshotId): SnapshotDefinition =>
  SNAPSHOT_DEFINITIONS[id] ?? SNAPSHOT_DEFINITIONS[DEFAULT_SNAPSHOT_ID];

export type { SnapshotDefinition } from "./types";
