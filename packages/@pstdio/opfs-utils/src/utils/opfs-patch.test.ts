import { describe, expect, it } from "vitest";
import { setupTestOPFS, writeFile } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../shared";
import { applyPatchInOPFS, normalizeGitPath, normalizeSegments, stagePathForGit } from "./opfs-patch";

describe("normalizeGitPath", () => {
  it("cleans diff paths", () => {
    expect(normalizeGitPath("a/foo/bar.txt")).toBe("foo/bar.txt");
    expect(normalizeGitPath("b/../baz.txt")).toBe("baz.txt");
    expect(normalizeGitPath("/dev/null")).toBeNull();
  });
});

describe("normalizeSegments", () => {
  it("splits and normalizes segments", () => {
    expect(normalizeSegments(" /a//b/../c ")).toEqual(["a", "c"]);
  });
});

describe("stagePathForGit", () => {
  it("maps workDir and file path", () => {
    expect(stagePathForGit("pkg", "file.txt")).toBe("pkg/file.txt");
    expect(stagePathForGit("", "file.txt")).toBe("file.txt");
  });
});

describe("applyPatchInOPFS", () => {
  it("applies content changes in OPFS", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "file.txt", "old");

    const result = await applyPatchInOPFS({ root, diffContent: "diff" });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("file.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("patched");
  });
});
