import type { Lockfile } from "../../src/core/import-map";
import type { VirtualSnapshot } from "../../src/core/snapshot";
import type { SnapshotVariant } from "../compileScenarioShared";

export type SnapshotBuilder = (variant: SnapshotVariant) => VirtualSnapshot;

export interface SnapshotDefinition {
  id: string;
  label: string;
  description?: string;
  lockfile?: Lockfile | null;
  build: SnapshotBuilder;
}
