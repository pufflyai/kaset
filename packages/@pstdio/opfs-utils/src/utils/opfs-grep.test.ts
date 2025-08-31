import { describe, expect, it } from "vitest";
import { getOPFSRoot } from "../shared";
import { globToRegExp, grep, shouldSkip, toGlobalRegex } from "./opfs-grep";
import { setupTestOPFS, writeFile } from "../__helpers__/test-opfs";

describe("toGlobalRegex", () => {
  it("ensures global flag", () => {
    expect(toGlobalRegex("foo", "i").flags).toBe("gi");
    expect(toGlobalRegex(/bar/).flags).toBe("g");
  });
});

describe("globToRegExp", () => {
  it("matches simple globs", () => {
    const re = globToRegExp("**/*.ts");
    expect(re.test("src/index.ts")).toBe(true);
    expect(re.test("src/index.js")).toBe(false);
  });
});

describe("shouldSkip", () => {
  it("applies include and exclude rules", () => {
    const include = [/^src\/.*$/];
    const exclude = [/node_modules/];

    expect(shouldSkip("src/app.ts", include, exclude)).toBe(false);
    expect(shouldSkip("node_modules/pkg/index.ts", include, exclude)).toBe(true);
    expect(shouldSkip("other/file.ts", include, exclude)).toBe(true);
  });
});

describe("grep over OPFS", () => {
  it("finds pattern matches", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "readme.txt", "hello world\nbye");

    const matches = await grep(root, { pattern: "world" });
    expect(matches).toHaveLength(1);
    expect(matches[0].file).toBe("readme.txt");
  });
});
