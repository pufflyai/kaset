import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { generateContext } from "./core";

const TEST_DIR = "/tmp/gitignore-test";

describe("Gitignore Integration", () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should respect .gitignore in target directory", async () => {
    // Create test files
    await writeFile(join(TEST_DIR, ".gitignore"), "ignored-file.txt\nignored-dir/\n");
    await writeFile(join(TEST_DIR, "included.txt"), "content");
    await writeFile(join(TEST_DIR, "ignored-file.txt"), "content");
    await mkdir(join(TEST_DIR, "ignored-dir"));
    await writeFile(join(TEST_DIR, "ignored-dir", "file.txt"), "content");

    const result = await generateContext(TEST_DIR);
    const files = result.files;
    const relevantFilePaths = files.filter(f => f.isRelevant).map(f => f.relativePath);

    expect(relevantFilePaths).toContain("included.txt");
    expect(relevantFilePaths).not.toContain("ignored-file.txt");
    expect(relevantFilePaths).not.toContain("ignored-dir");
  });

  it("should respect .gitignore in parent directory", async () => {
    // Create parent .gitignore
    await writeFile(join(TEST_DIR, ".gitignore"), "*.log\n");
    
    // Create subdirectory with files
    const subDir = join(TEST_DIR, "subdir");
    await mkdir(subDir);
    await writeFile(join(subDir, "app.log"), "log content");
    await writeFile(join(subDir, "app.txt"), "text content");

    const result = await generateContext(subDir);
    const files = result.files;
    const relevantFilePaths = files.filter(f => f.isRelevant).map(f => f.relativePath);

    expect(relevantFilePaths).toContain("app.txt");
    expect(relevantFilePaths).not.toContain("app.log");
  });

  it("should handle negation patterns (!pattern)", async () => {
    await writeFile(join(TEST_DIR, ".gitignore"), "*.txt\n!important.txt\n");
    await writeFile(join(TEST_DIR, "debug.txt"), "content");
    await writeFile(join(TEST_DIR, "important.txt"), "content");
    await writeFile(join(TEST_DIR, "app.js"), "content");

    const result = await generateContext(TEST_DIR);
    const files = result.files;
    const relevantFilePaths = files.filter(f => f.isRelevant).map(f => f.relativePath);

    expect(relevantFilePaths).toContain("app.js");
    expect(relevantFilePaths).toContain("important.txt"); // negated, should be included
    expect(relevantFilePaths).not.toContain("debug.txt"); // ignored
  });

  it("should handle directory patterns (ending with /)", async () => {
    await writeFile(join(TEST_DIR, ".gitignore"), "temp/\n");
    await mkdir(join(TEST_DIR, "temp"));
    await writeFile(join(TEST_DIR, "temp", "file.txt"), "content");
    await writeFile(join(TEST_DIR, "temp.txt"), "content"); // file with same prefix

    const result = await generateContext(TEST_DIR);
    const files = result.files;
    const relevantFilePaths = files.filter(f => f.isRelevant).map(f => f.relativePath);

    expect(relevantFilePaths).toContain("temp.txt"); // file should be included
    expect(relevantFilePaths).not.toContain("temp"); // directory should be ignored
  });

  it("should maintain existing skip behavior for hardcoded patterns", async () => {
    // Test that existing skip logic still works
    await mkdir(join(TEST_DIR, "node_modules"));
    await writeFile(join(TEST_DIR, "node_modules", "package.json"), "{}");
    await writeFile(join(TEST_DIR, ".DS_Store"), "binary");

    const result = await generateContext(TEST_DIR);
    const files = result.files;
    const relevantFilePaths = files.filter(f => f.isRelevant).map(f => f.relativePath);

    expect(relevantFilePaths).not.toContain("node_modules");
    expect(relevantFilePaths).not.toContain(".DS_Store");
  });
});