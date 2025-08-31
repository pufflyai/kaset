import { describe, expect, it } from "vitest";
import { detectFileType, getSpecificMimeType, isWithinRoot } from "./opfs-files";

describe("getSpecificMimeType", () => {
  it("returns known MIME type", () => {
    expect(getSpecificMimeType("file.txt")).toBe("text/plain");
  });

  it("returns undefined for unknown extension", () => {
    expect(getSpecificMimeType("file.unknown")).toBeUndefined();
  });
});

describe("isWithinRoot", () => {
  it("detects path within root", () => {
    expect(isWithinRoot("project/src/index.ts", "project")).toBe(true);
  });

  it("detects path outside root", () => {
    expect(isWithinRoot("other/file.ts", "project")).toBe(false);
  });
});

describe("detectFileType", () => {
  it("classifies by extension", async () => {
    await expect(detectFileType("image.png")).resolves.toBe("image");
    await expect(detectFileType("archive.zip")).resolves.toBe("binary");
    await expect(detectFileType("code.ts")).resolves.toBe("text");
    await expect(detectFileType("graphic.svg")).resolves.toBe("svg");
  });
});
