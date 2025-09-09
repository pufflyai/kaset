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

  it("accepts hunks without line numbers (lenient @@)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "file.txt", "old\nline2\n");

    const diff = ["--- a/file.txt", "+++ b/file.txt", "@@", "-old", "+patched", " line2", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff, maxOffsetLines: 50 });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("file.txt");
    const text = await (await fh.getFile()).text();
    // Mocked applyPatch returns "patched" regardless; assert write occurred
    expect(text).toBe("patched");
  });

  it("creates a new file with numberless @@ hunk (only additions)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    const diff = ["--- /dev/null", "+++ b/new.txt", "@@", "+hello", "+world", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("new.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("patched");
  });

  it("deletes a file with numberless @@ hunk (only deletions)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "gone.txt", "remove me\n");

    const diff = ["--- a/gone.txt", "+++ /dev/null", "@@", "-remove me", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);
    await expect(async () => (root as any).getFileHandle("gone.txt")).rejects.toBeTruthy();
  });

  it("treats deletion of a missing file as success (numberless @@)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    const diff = ["--- a/missing.txt", "+++ /dev/null", "@@", "-whatever", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);
  });

  it("handles multi-hunk numberless @@ modifications in one file", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "multi.txt", "a\nb\nc\nd\n");

    const diff = ["--- a/multi.txt", "+++ b/multi.txt", "@@", " a", "-b", "+B", " c", "@@", " c", "-d", "+D", ""].join(
      "\n",
    );

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);
    const fh = await (root as any).getFileHandle("multi.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("patched");
  });

  it("renames a file with numberless @@ hunk", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "old/name.txt", "content\n");

    const diff = ["--- a/old/name.txt", "+++ b/new/name.txt", "@@", " content", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    // Old should be gone, new should exist
    await expect(async () => (root as any).getFileHandle("old/name.txt")).rejects.toBeTruthy();
    const newDir = await (root as any).getDirectoryHandle("new");
    const fh = await newDir.getFileHandle("name.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("patched");
  });

  it("fails when numberless @@ hunk context is not found", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "no-match.txt", "alpha\nbeta\n");

    const diff = [
      "--- a/no-match.txt",
      "+++ b/no-match.txt",
      "@@",
      "-GAMMA", // does not exist in file
      "+DELTA",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(false);
    expect(result.output).toContain("Failed to parse patch:");
  });

  it("applies a multi-file diff with numeric headers (modify, delete, create)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "a.txt", "foo\nbar\n");
    await writeFile(root, "docs/old.md", "deprecated\n");

    const diff = [
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,2 +1,2 @@",
      "-foo",
      "+FOO",
      " bar",
      "",
      "--- a/docs/old.md",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-deprecated",
      "",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,2 @@",
      "+export const x = 1;",
      "+export const y = 2;",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    // a.txt should be modified
    const a = await (root as any).getFileHandle("a.txt");
    const aText = await (await a.getFile()).text();
    expect(aText).toBe("patched");

    // docs/old.md should be deleted
    await expect(async () => (root as any).getFileHandle("docs/old.md")).rejects.toBeTruthy();

    // src/new.ts should exist
    const src = await (root as any).getDirectoryHandle("src");
    const newTs = await src.getFileHandle("new.ts");
    const newText = await (await newTs.getFile()).text();
    expect(newText).toBe("patched");
  });

  it("applies a multi-file diff with numberless @@ headers (modify, delete, create)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "a2.txt", "foo\nbar\n");
    await writeFile(root, "docs/old2.md", "deprecated-2\n");

    const diff = [
      "--- a/a2.txt",
      "+++ b/a2.txt",
      "@@",
      "-foo",
      "+FOO",
      " bar",
      "",
      "--- a/docs/old2.md",
      "+++ /dev/null",
      "@@",
      "-deprecated-2",
      "",
      "--- /dev/null",
      "+++ b/src/new2.ts",
      "@@",
      "+lineA",
      "+lineB",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    // a2.txt should be modified
    const a2 = await (root as any).getFileHandle("a2.txt");
    const a2Text = await (await a2.getFile()).text();
    expect(a2Text).toBe("patched");

    // docs/old2.md should be deleted
    await expect(async () => (root as any).getFileHandle("docs/old2.md")).rejects.toBeTruthy();

    // src/new2.ts should exist
    const src = await (root as any).getDirectoryHandle("src");
    const new2 = await src.getFileHandle("new2.ts");
    const new2Text = await (await new2.getFile()).text();
    expect(new2Text).toBe("patched");
  });
});
