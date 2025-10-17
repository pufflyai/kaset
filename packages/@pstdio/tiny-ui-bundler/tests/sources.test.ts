import { afterEach, describe, expect, it } from "vitest";
import { getSource, registerSources, removeSource, updateSource } from "../src/core/sources";

describe("sources", () => {
  afterEach(() => {
    removeSource("alpha");
  });

  it("registers and clones source configs", () => {
    registerSources([{ id: "alpha", root: "/root" }]);
    const first = getSource("alpha");
    expect(first).toEqual({ id: "alpha", root: "/root" });

    if (!first) throw new Error("expected source");
    first.root = "/mutated";
    const second = getSource("alpha");
    expect(second).toEqual({ id: "alpha", root: "/root" });
  });

  it("updates registered sources", () => {
    registerSources([{ id: "alpha", root: "/root" }]);
    updateSource({ id: "alpha", root: "/updated" });
    expect(getSource("alpha")).toEqual({ id: "alpha", root: "/updated" });
  });

  it("removes source configs", () => {
    registerSources([{ id: "alpha", root: "/root" }]);
    removeSource("alpha");
    expect(getSource("alpha")).toBeUndefined();
  });
});
