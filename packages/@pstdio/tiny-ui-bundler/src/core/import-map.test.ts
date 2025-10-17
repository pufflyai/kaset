import { describe, expect, it } from "vitest";
import { buildImportMap } from "./import-map";

describe("import-map", () => {
  it("mirrors the lockfile entries", () => {
    const lockfile = {
      react: "https://cdn/react.js",
      "react-dom": "https://cdn/react-dom.js",
    };

    expect(buildImportMap(lockfile)).toEqual({ imports: lockfile });
  });
});
