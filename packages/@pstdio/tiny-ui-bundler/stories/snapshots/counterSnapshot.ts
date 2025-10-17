import { ENTRY_PATH, type SnapshotVariant } from "../compileScenarioShared";
import type { SnapshotDefinition } from "./types";
import { applyReplacements } from "./utils";

import indexTemplate from "./counter/files/index.ts?raw";
import counterTemplate from "./counter/files/counter.ts?raw";
import stylesTemplate from "./counter/files/styles.css?raw";

const COUNTER_VARIANTS: Record<
  SnapshotVariant,
  {
    initial: number;
    step: number;
    color: string;
    message: string;
  }
> = {
  fresh: {
    initial: 0,
    step: 1,
    color: "#4338ca",
    message: "Counter ready after two increments.",
  },
  updated: {
    initial: 3,
    step: 2,
    color: "#db2777",
    message: "Counter updated to use double-step increments.",
  },
};

export const counterSnapshot: SnapshotDefinition = {
  id: "counter",
  label: "Counter widget",
  description: "A tiny counter module whose behaviour changes across snapshot variants.",
  build: (variant) => {
    const config = COUNTER_VARIANTS[variant];
    const messageLiteral = JSON.stringify(config.message);

    return {
      entry: ENTRY_PATH,
      files: {
        "/index.ts": applyReplacements(indexTemplate, { __MESSAGE__: messageLiteral }),
        "/counter.ts": applyReplacements(counterTemplate, {
          __INITIAL__: String(config.initial),
          __STEP__: String(config.step),
        }),
        "/styles.css": applyReplacements(stylesTemplate, {
          __COLOR__: config.color,
          __MESSAGE__: messageLiteral,
        }),
      },
    };
  },
};
