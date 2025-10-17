import { ENTRY_PATH, type SnapshotVariant } from "../compileScenarioShared";
import type { SnapshotDefinition } from "./types";
import { applyReplacements } from "./utils";

import indexSource from "./default/files/index.ts?raw";
import messageTemplate from "./default/files/message.ts?raw";
import stylesTemplate from "./default/files/styles.css?raw";

const MESSAGE_VARIANTS: Record<SnapshotVariant, string> = {
  fresh: "Hello from the Tiny UI bundler story.",
  updated: "The source files changed, so this bundle is rebuilt.",
};

export const defaultSnapshot: SnapshotDefinition = {
  id: "default",
  label: "Greeting bundle",
  description: "Simple greeting modules and CSS variable wiring used by the original compile story.",
  build: (variant) => {
    const message = MESSAGE_VARIANTS[variant];
    const messageLiteral = JSON.stringify(message);

    return {
      entry: ENTRY_PATH,
      files: {
        "/index.ts": indexSource,
        "/message.ts": applyReplacements(messageTemplate, { __MESSAGE__: messageLiteral }),
        "/styles.css": applyReplacements(stylesTemplate, { __MESSAGE__: messageLiteral }),
      },
    };
  },
};
