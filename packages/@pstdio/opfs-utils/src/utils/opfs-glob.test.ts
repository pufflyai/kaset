import { describe, expect, it } from "vitest";
import { getOPFSRoot } from "../__helpers__/test-opfs";
import { setupTestOPFS, writeFile } from "../__helpers__/test-opfs";
import { opfsGlob, sortFileEntries, type GlobPath } from "./opfs-glob";

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

describe("opfsGlob", () => {
  it("matches brace patterns and ignores node_modules/.git by default", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "src/index.ts", "ts");
    await writeFile(root, "src/index.tsx", "tsx");
    await writeFile(root, "src/readme.md", "md");
    await writeFile(root, "src/notes.txt", "txt");
    await writeFile(root, "node_modules/pkg/index.ts", "nm");
    await writeFile(root, ".git/config", "git");

    const res = await opfsGlob(root, { pattern: "**/*.{ts,tsx,txt}", stat: false });
    expect(res.entries.map((e) => e.fullpath())).toEqual(["/src/index.ts", "/src/index.tsx", "/src/notes.txt"]);
    expect(res.gitIgnored).toBe(0);
  });

  it("respects dot option for leading-dot files in segment wildcards", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, ".gitignore", "dist/\n");
    await writeFile(root, "file.txt", "ok");

    const withDot = await opfsGlob(root, { pattern: "*", stat: false, dot: true });
    expect(withDot.entries.map((e) => e.fullpath())).toEqual(["/.gitignore", "/file.txt"]);

    const noDot = await opfsGlob(root, { pattern: "*", stat: false, dot: false });
    expect(noDot.entries.map((e) => e.fullpath())).toEqual(["/file.txt"]);
  });

  it("matches case-insensitively by default", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "SRC/App.TS", "export {}\n");

    const res = await opfsGlob(root, { pattern: "**/*.ts", stat: false });
    expect(res.entries.map((e) => e.fullpath())).toEqual(["/SRC/App.TS"]);
  });

  it("limits search to a subdirectory via path option", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "src/app.ts", "ok");
    await writeFile(root, "lib/app.ts", "nope");

    const res = await opfsGlob(root, { pattern: "*.ts", path: "src", stat: false });
    expect(res.entries.map((e) => e.fullpath())).toEqual(["/src/app.ts"]);
  });

  it("applies .gitignore rules at the search root (with negation)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "src/.gitignore", "dist/\n!dist/keep.js\n");
    await writeFile(root, "src/dist/index.js", "ignored");
    await writeFile(root, "src/dist/keep.js", "kept");
    await writeFile(root, "src/app.js", "app");

    const res = await opfsGlob(root, { pattern: "{*.js,**/*.js}", path: "src", stat: false });
    expect(res.entries.map((e) => e.fullpath())).toEqual(["/src/app.js", "/src/dist/keep.js"]);
    // gitIgnored count should reflect at least one file filtered
    expect(res.gitIgnored).toBeGreaterThan(0);
  });

  it("treats exact existing path as a literal (no wildcard matching)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "src/*foo?.txt", "literal");
    await writeFile(root, "src/abfooZ.txt", "wildcard would match if not literal");

    const res = await opfsGlob(root, { pattern: "*foo?.txt", path: "src", stat: false });
    expect(res.entries.map((e) => e.fullpath())).toEqual(["/src/*foo?.txt"]);
  });
});
