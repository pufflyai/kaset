import { beforeEach, describe, expect, it } from "vitest";
import { getBasePath, resetBasePath, resolveBasePath, setBasePath } from "../src/core/base-path";

describe("base-path", () => {
  beforeEach(() => {
    resetBasePath();
  });

  it("normalizes the registered base path", () => {
    setBasePath("play");
    expect(getBasePath()).toBe("/play/");

    setBasePath("/root");
    expect(getBasePath()).toBe("/root/");
  });

  it("resolves paths relative to the base", () => {
    setBasePath("play");
    expect(resolveBasePath("virtual/bundle.js")).toBe("/play/virtual/bundle.js");
    expect(resolveBasePath("/virtual/bundle.js")).toBe("/play/virtual/bundle.js");

    setBasePath("/");
    expect(resolveBasePath("/virtual/bundle.js")).toBe("/virtual/bundle.js");
    expect(resolveBasePath("")).toBe("/");
  });
});
