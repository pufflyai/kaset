import { describe, expect, it } from "vitest";
import {
  basename,
  hasParentTraversal,
  isWithinRoot,
  joinPath,
  joinUnderWorkspace,
  normalizeRoot,
  normalizeSegments,
  normalizeSlashes,
  parentOf,
} from "./path";

describe("normalizeSegments", () => {
  it("trims, removes '.' and collapses '..'", () => {
    expect(normalizeSegments(" /a//./b/../c ")).toEqual(["a", "c"]);
  });

  it("drops leading '..' segments instead of going above root", () => {
    expect(normalizeSegments("../../etc")).toEqual(["etc"]);
    expect(normalizeSegments("..\n/..\t/ a ")).toEqual(["a"]);
  });

  it("handles empty input", () => {
    expect(normalizeSegments("")).toEqual([]);
  });
});

describe("normalizeSlashes", () => {
  it("collapses duplicate slashes and trims leading/trailing separators", () => {
    expect(normalizeSlashes("a//b///c")).toBe("a/b/c");
    expect(normalizeSlashes("//a//")).toBe("a");
  });
});

describe("joinPath", () => {
  it("joins two path parts with normalization", () => {
    expect(joinPath("a/b", "c/d")).toBe("a/b/c/d");
    expect(joinPath("a/b/", "/c/d")).toBe("a/b/c/d");
  });

  it("handles empty sides", () => {
    expect(joinPath("", "a")).toBe("a");
    expect(joinPath("a", "")).toBe("a");
    expect(joinPath("", "")).toBe("");
  });
});

describe("parentOf", () => {
  it("returns the parent directory portion", () => {
    expect(parentOf("a/b/c")).toBe("a/b");
    expect(parentOf("a")).toBe("");
    expect(parentOf("")).toBe("");
  });
});

describe("basename", () => {
  it("returns the filename portion", () => {
    expect(basename("a/b/c")).toBe("c");
    expect(basename("a")).toBe("a");
    expect(basename("")).toBe("");
  });
});

describe("hasParentTraversal", () => {
  it("detects '..' traversal across platforms", () => {
    expect(hasParentTraversal("../a")).toBe(true);
    expect(hasParentTraversal("a/..")).toBe(true);
    expect(hasParentTraversal("a/../b")).toBe(true);
    expect(hasParentTraversal("a\\..\\b")).toBe(true); // Windows style
  });

  it("ignores lookalikes that are not standalone '..' segments", () => {
    expect(hasParentTraversal("a/..b")).toBe(false);
    expect(hasParentTraversal("a/....")).toBe(false);
    expect(hasParentTraversal("")).toBe(false);
    expect(hasParentTraversal()).toBe(false);
  });
});

describe("isWithinRoot", () => {
  it("checks containment using normalized segments", () => {
    expect(isWithinRoot("a/b", "a")).toBe(true);
    expect(isWithinRoot("a/b/c", "a/b")).toBe(true);
    expect(isWithinRoot("a/b", "a/b")).toBe(true); // equal is within
    expect(isWithinRoot("a/bc", "a/b")).toBe(false);
    expect(isWithinRoot("a", "a/b")).toBe(false);
  });

  it("treats empty root as allowing all", () => {
    expect(isWithinRoot("anything", "")).toBe(true);
  });

  it("normalizes '..' and '.' in the input path", () => {
    expect(isWithinRoot("a//b/../c", "a")).toBe(true); // a/c within a
  });
});

describe("joinUnderWorkspace", () => {
  it("joins relative path under workspace", () => {
    expect(joinUnderWorkspace("ws", "a/b")).toBe("ws/a/b");
    expect(joinUnderWorkspace("", "a")).toBe("a");
  });

  it("never escapes the workspace; leading '..' are dropped by normalization", () => {
    expect(joinUnderWorkspace("ws", "../a")).toBe("ws/a");
    // Child is normalized independently, so it joins under the provided base
    expect(joinUnderWorkspace("ws/sub", "../../a")).toBe("ws/sub/a");
  });

  it("returns '.' when both inputs are effectively empty", () => {
    expect(joinUnderWorkspace("", "")).toBe(".");
  });
});

describe("normalizeRoot", () => {
  it("normalizes slashes and trims whitespace", () => {
    expect(normalizeRoot(" //plugins//active/ ")).toBe("plugins/active");
  });

  it("falls back when input is empty", () => {
    expect(normalizeRoot(undefined, { fallback: " /plugins/ " })).toBe("plugins");
  });

  it("throws when configured with an error message", () => {
    expect(() => normalizeRoot("  ", { errorMessage: "Root required" })).toThrowError("Root required");
  });
});
