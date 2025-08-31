import { describe, expect, it } from "vitest";
import { sortFileEntries, type GlobPath } from "./opfs-glob";

function mockPath(path: string, mtimeMs: number): GlobPath {
  return {
    fullpath: () => path,
    mtimeMs,
  };
}

describe("sortFileEntries", () => {
  it("orders recent files before older ones", () => {
    const now = 100_000;
    const threshold = 10_000;
    const entries = [
      mockPath("/b.txt", now - 1_000),
      mockPath("/a.txt", now - 500),
      mockPath("/d.txt", now - 20_000),
      mockPath("/c.txt", now - 20_000),
    ];

    const sorted = sortFileEntries(entries, now, threshold);
    expect(sorted.map((e) => e.fullpath())).toEqual(["/a.txt", "/b.txt", "/c.txt", "/d.txt"]);
  });
});
