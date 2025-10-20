import { describe, expect, it, vi } from "vitest";
import { mergeDependencies } from "./dependencies";

describe("mergeDependencies", () => {
  it("merges dependencies and reports conflicts", () => {
    const conflict = vi.fn();
    const result = mergeDependencies(
      [
        { id: "alpha", dependencies: { react: "https://cdn/react-18.js", lodash: "https://cdn/lodash.js" } },
        { id: "beta", dependencies: { react: "https://cdn/react-19.js", zod: "https://cdn/zod.js" } },
        { id: "gamma", dependencies: { lodash: "https://cdn/lodash.js" } },
      ],
      conflict,
    );

    expect(result).toEqual({
      react: "https://cdn/react-19.js",
      lodash: "https://cdn/lodash.js",
      zod: "https://cdn/zod.js",
    });

    expect(conflict).toHaveBeenCalledTimes(1);
    expect(conflict).toHaveBeenCalledWith(
      "react",
      { pluginId: "alpha", url: "https://cdn/react-18.js" },
      { pluginId: "beta", url: "https://cdn/react-19.js" },
    );
  });

  it("omits empty or non-string dependency values", () => {
    const result = mergeDependencies([
      { id: "alpha", dependencies: { valid: "https://cdn/file.js", empty: "", bad: 123 as unknown as string } },
    ]);

    expect(result).toEqual({ valid: "https://cdn/file.js" });
  });
});
