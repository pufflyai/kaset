import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseGitignore, isIgnoredByGitignore, loadGitignoreContext } from "./gitignore";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";

const TEST_DIR = "/tmp/gitignore-unit-test";

describe("Gitignore Parser Unit Tests", () => {
  beforeEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  it("should parse simple gitignore patterns", () => {
    const content = "*.log\nnode_modules/\n!important.log";
    const rules = parseGitignore(content);

    expect(rules).toHaveLength(3);
    expect(rules[0].pattern).toBe("*.log");
    expect(rules[0].isNegation).toBe(false);
    expect(rules[0].isDirectoryOnly).toBe(false);

    expect(rules[1].pattern).toBe("node_modules");
    expect(rules[1].isNegation).toBe(false);
    expect(rules[1].isDirectoryOnly).toBe(true);

    expect(rules[2].pattern).toBe("important.log");
    expect(rules[2].isNegation).toBe(true);
    expect(rules[2].isDirectoryOnly).toBe(false);
  });

  it("should match file patterns correctly", () => {
    const rules = parseGitignore("*.log\nnode_modules/");

    expect(isIgnoredByGitignore("app.log", false, rules)).toBe(true);
    expect(isIgnoredByGitignore("app.txt", false, rules)).toBe(false);
    expect(isIgnoredByGitignore("node_modules", true, rules)).toBe(true);
    expect(isIgnoredByGitignore("node_modules", false, rules)).toBe(false); // file with same name
  });

  it("should handle negation patterns", () => {
    const rules = parseGitignore("*.log\n!important.log");

    expect(isIgnoredByGitignore("app.log", false, rules)).toBe(true);
    expect(isIgnoredByGitignore("important.log", false, rules)).toBe(false); // negated
  });

  it("should load gitignore from filesystem", async () => {
    await writeFile(join(TEST_DIR, ".gitignore"), "*.tmp\ntest-dir/");
    
    const context = await loadGitignoreContext(TEST_DIR);
    
    expect(context.rules).toHaveLength(2);
    expect(context.gitignoreFiles).toContain(join(TEST_DIR, ".gitignore"));
  });

  it("should load gitignore from parent directories", async () => {
    // Parent gitignore
    await writeFile(join(TEST_DIR, ".gitignore"), "*.parent");
    
    // Subdirectory
    const subDir = join(TEST_DIR, "subdir");
    await mkdir(subDir);
    await writeFile(join(subDir, ".gitignore"), "*.child");
    
    const context = await loadGitignoreContext(subDir);
    
    expect(context.rules).toHaveLength(2);
    expect(context.rules.some(r => r.pattern === "*.child")).toBe(true);
    expect(context.rules.some(r => r.pattern.includes("parent"))).toBe(true);
  });
});