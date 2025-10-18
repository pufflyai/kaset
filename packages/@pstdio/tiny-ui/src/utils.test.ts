import { describe, expect, it } from "vitest";
import { ensureLeadingSlash, isHttpUrl, joinPath, loaderFromPath } from "./utils";

describe("ensureLeadingSlash", () => {
  it("adds a slash when the value is missing one", () => {
    expect(ensureLeadingSlash("foo/bar")).toBe("/foo/bar");
  });

  it("keeps the leading slash when present", () => {
    expect(ensureLeadingSlash("/foo/bar")).toBe("/foo/bar");
  });
});

describe("loaderFromPath", () => {
  it("ignores query and hash parts when detecting loader", () => {
    expect(loaderFromPath("/app/main.tsx?version=1#hash")).toBe("tsx");
  });

  it("falls back to javascript when the extension is unknown", () => {
    expect(loaderFromPath("/assets/readme.md")).toBe("js");
  });
});

describe("isHttpUrl", () => {
  it("returns true for http and https schemes", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("https://example.com")).toBe(true);
  });

  it("returns false for other schemes", () => {
    expect(isHttpUrl("ftp://example.com")).toBe(false);
    expect(isHttpUrl("/local/path")).toBe(false);
  });
});

describe("joinPath", () => {
  it("resolves relative segments against the importer path", () => {
    expect(joinPath("/plugins/app.js", "./panel.ts")).toBe("/plugins/panel.ts");
  });

  it("supports navigating to parent directories", () => {
    expect(joinPath("/plugins/app/index.js", "../assets/style.css")).toBe("/plugins/assets/style.css");
  });

  it("returns the segment when it is already absolute", () => {
    expect(joinPath("/plugins/app.js", "/static/app.css")).toBe("/static/app.css");
  });
});
