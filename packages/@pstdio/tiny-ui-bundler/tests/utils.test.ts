import { describe, expect, it } from "vitest";
import { ensureLeadingSlash, isHttpUrl, joinPath, loaderFromPath } from "../src/utils";

describe("utils", () => {
  it("ensureLeadingSlash", () => {
    expect(ensureLeadingSlash("a/b")).toBe("/a/b");
    expect(ensureLeadingSlash("/a")).toBe("/a");
  });

  it("loaderFromPath strips query/hash and maps extensions", () => {
    expect(loaderFromPath("/x.ts")).toBe("ts");
    expect(loaderFromPath("/x.tsx")).toBe("tsx");
    expect(loaderFromPath("/x.js")).toBe("js");
    expect(loaderFromPath("/x.jsx")).toBe("jsx");
    expect(loaderFromPath("/x.json")).toBe("json");
    expect(loaderFromPath("/x.css")).toBe("css");
    expect(loaderFromPath("/x.mjs?foo=1#bar")).toBe("js");
    expect(loaderFromPath("/x.unknown")).toBe("js");
  });

  it("isHttpUrl", () => {
    expect(isHttpUrl("https://a")).toBe(true);
    expect(isHttpUrl("http://a")).toBe(true);
    expect(isHttpUrl("/a")).toBe(false);
  });

  it("joinPath resolves relative segments", () => {
    expect(joinPath("/a/b/c.ts", "./d")).toBe("/a/b/d");
    expect(joinPath("/a/b/c.ts", "../d")).toBe("/a/d");
    expect(joinPath("/a/b/c.ts", "/z")).toBe("/z");
  });
});
