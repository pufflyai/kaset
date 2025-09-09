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
  it("treats header-only diffs as no-ops", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "stay.txt", "unchanged\n");

    const diff = [
      "--- a/stay.txt",
      "+++ b/stay.txt",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);
    expect(result.output).toBe("No changes in patch (no hunks).");

    const fh = await (root as any).getFileHandle("stay.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("unchanged\n");
  });

  it("stages under workDir with correct mapped paths (modify/create/delete)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    // Prepare files under the workDir
    await writeFile(root, "workspace/pkg/a.txt", "old\n");
    await writeFile(root, "workspace/pkg/old.txt", "to-delete\n");

    const diff = [
      // modify a.txt
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+NEW",
      "",
      // create created.txt
      "--- /dev/null",
      "+++ b/created.txt",
      "@@ -0,0 +1,1 @@",
      "+hi",
      "",
      // delete old.txt
      "--- a/old.txt",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-to-delete",
      "",
    ].join("\n");

    const calls: Array<{ op: string; filepath: string }> = [];
    const fakeGit = {
      add: async ({ filepath }: { filepath: string }) => {
        calls.push({ op: "add", filepath });
      },
      remove: async ({ filepath }: { filepath: string }) => {
        calls.push({ op: "remove", filepath });
      },
    } as any;

    const result = await applyPatchInOPFS({
      root,
      workDir: "workspace/pkg",
      diffContent: diff,
      git: { git: fakeGit, fs: {}, dir: "/repo" },
    });

    expect(result.success).toBe(true);

    // Validate staged paths include workDir
    const paths = calls.map((c) => `${c.op}:${c.filepath}`).sort();
    expect(paths).toEqual([
      "add:workspace/pkg/a.txt",
      "add:workspace/pkg/created.txt",
      "remove:workspace/pkg/old.txt",
    ].sort());

    // Validate content changes actually applied under workDir
    const wd = await (root as any).getDirectoryHandle("workspace");
    const pkg = await wd.getDirectoryHandle("pkg");
    const a = await pkg.getFileHandle("a.txt");
    expect(await (await a.getFile()).text()).toBe("NEW\n");
    const created = await pkg.getFileHandle("created.txt");
    expect(await (await created.getFile()).text()).toBe("hi\n");
    await expect(async () => pkg.getFileHandle("old.txt")).rejects.toBeTruthy();
  });

  it("reports failure details when modifying a missing target file", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    const diff = [
      "--- a/missing.txt",
      "+++ b/missing.txt",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(false);
    expect(result.output).toContain("Patch completed with errors");
    expect(result.details?.failed?.length).toBe(1);
    expect(result.details?.failed?.[0].path).toBe("missing.txt");
    expect(result.details?.failed?.[0].reason).toContain("Target file not found");
  });

  it("handles diffs with 'No newline at end of file' markers", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    // Pre-image without trailing newline
    await writeFile(root, "nonewline.txt", "hello");

    const diff = [
      "--- a/nonewline.txt",
      "+++ b/nonewline.txt",
      "@@",
      "-hello",
      "+HELLO",
      "\\ No newline at end of file",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("nonewline.txt");
    const text = await (await fh.getFile()).text();
    // Should preserve lack of trailing newline
    expect(text).toBe("HELLO");
  });
  it("applies content changes in OPFS", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "file.txt", "old\n");

    const diff = ["--- a/file.txt", "+++ b/file.txt", "@@ -1,1 +1,1 @@", "-old", "+patched", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("file.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("patched\n");
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
    expect(text).toBe("patched\nline2\n");
  });

  it("accepts empty hunk header '@@ @@'", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "file2.txt", "old\nline2\n");

    const diff = ["--- a/file2.txt", "+++ b/file2.txt", "@@ @@", "-old", "+patched", " line2", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff, maxOffsetLines: 50 });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("file2.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("patched\nline2\n");
  });

  it("creates a new file with numberless @@ hunk (only additions)", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    const diff = ["--- /dev/null", "+++ b/new.txt", "@@", "+hello", "+world", ""].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("new.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("hello\nworld\n");
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
    expect(text).toBe("a\nB\nc\nD\n");
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
    expect(text).toBe("content\n");
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
    expect(result.output).toContain("Patch completed with errors");
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
    expect(aText).toBe("FOO\nbar\n");

    // docs/old.md should be deleted
    await expect(async () => (root as any).getFileHandle("docs/old.md")).rejects.toBeTruthy();

    // src/new.ts should exist
    const src = await (root as any).getDirectoryHandle("src");
    const newTs = await src.getFileHandle("new.ts");
    const newText = await (await newTs.getFile()).text();
    expect(newText).toBe("export const x = 1;\nexport const y = 2;\n");
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
    expect(a2Text).toBe("FOO\nbar\n");

    // docs/old2.md should be deleted
    await expect(async () => (root as any).getFileHandle("docs/old2.md")).rejects.toBeTruthy();

    // src/new2.ts should exist
    const src = await (root as any).getDirectoryHandle("src");
    const new2 = await src.getFileHandle("new2.ts");
    const new2Text = await (await new2.getFile()).text();
    expect(new2Text).toBe("lineA\nlineB\n");
  });

  it("handles content lines beginning with '-' (e.g., '- [ ] asd')", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "todos.md", ["# items", "- [ ] asd", "- [ ] zxc", ""].join("\n"));

    const diff = [
      "--- a/todos.md",
      "+++ b/todos.md",
      "@@",
      " # items",
      "-- [ ] asd",
      "+- [x] asd",
      " - [ ] zxc",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    const fh = await (root as any).getFileHandle("todos.md");
    const text = await (await fh.getFile()).text();
    expect(text).toBe(["# items", "- [x] asd", "- [ ] zxc", ""].join("\n"));
  });

  it("applies a single hunk with multiple non-consecutive edits", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(
      root,
      "todos/multi.md",
      [
        "# Saturday",
        "",
        "- [ ] item1",
        "- [ ] item2",
        "- [ ] item3",
        "",
        // keep format
      ].join("\n"),
    );

    const diff = [
      "--- a/todos/multi.md",
      "+++ b/todos/multi.md",
      "@@",
      " # Saturday",
      " ",
      "-- [ ] item1",
      "+- [x] item1",
      " - [ ] item2",
      "-- [ ] item3",
      "+- [x] item3",
      " ",
      "",
    ].join("\n");

    const result = await applyPatchInOPFS({ root, diffContent: diff });
    expect(result.success).toBe(true);

    const todosDir = await (root as any).getDirectoryHandle("todos");
    const fh = await todosDir.getFileHandle("multi.md");
    const text = await (await fh.getFile()).text();
    expect(text).toBe(
      [
        "# Saturday",
        "",
        "- [x] item1",
        "- [ ] item2",
        "- [x] item3",
        "",
        // keep format
      ].join("\n"),
    );
  });
});
