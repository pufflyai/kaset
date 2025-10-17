import { ENTRY_PATH, type SnapshotVariant } from "../compileScenarioShared";
import type { SnapshotDefinition } from "./types";
import { applyReplacements } from "./utils";

import brokenEntrySource from "./broken/files/index.ts?raw";

const ERROR_NOTES: Record<SnapshotVariant, string> = {
  fresh: "Fresh snapshot references helper modules that were never registered.",
  updated: "Updated snapshot swaps to a different missing module to keep the bundle broken.",
};

const MISSING_TARGETS: Record<SnapshotVariant, string> = {
  fresh: "./widget",
  updated: "./theme",
};

export const brokenSnapshot: SnapshotDefinition = {
  id: "broken",
  label: "Broken bundle (missing modules)",
  description:
    "Intentional failure case that imports modules which are not part of the virtual snapshot, surfacing esbuild errors.",
  build: (variant) => {
    const reason = JSON.stringify(ERROR_NOTES[variant]).slice(1, -1);
    const missingPath = JSON.stringify(MISSING_TARGETS[variant]).slice(1, -1);

    return {
      entry: ENTRY_PATH,
      files: {
        "/index.ts": applyReplacements(brokenEntrySource, {
          __ERROR_REASON__: reason,
          __MISSING_PATH__: missingPath,
        }),
      },
    };
  },
};
