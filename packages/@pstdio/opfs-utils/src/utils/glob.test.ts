import { describe, expect, it } from "vitest";
import { expandBraces, globToRegExp } from "./glob";

describe("globToRegExp", () => {
  it("matches **, *, ? tokens", () => {
    const re = globToRegExp("**/*.ts");
    expect(re.test("src/index.ts")).toBe(true);
    expect(re.test("src/util/helper.ts")).toBe(true);
    expect(re.test("src/index.js")).toBe(false);

    const q = globToRegExp("file-?.txt");
    expect(q.test("file-1.txt")).toBe(true);
    expect(q.test("file-10.txt")).toBe(false);
  });

  it("respects dot option for leading dotfiles in segments", () => {
    const noDot = globToRegExp("*.js", { dot: false });
    const withDot = globToRegExp("*.js", { dot: true });

    expect(noDot.test("app.js")).toBe(true);
    expect(noDot.test(".eslintrc.js")).toBe(false);

    expect(withDot.test("app.js")).toBe(true);
    expect(withDot.test(".eslintrc.js")).toBe(true);
  });

  it("supports case-insensitive matching when caseSensitive=false", () => {
    const re = globToRegExp("**/*.TS", { caseSensitive: false });
    expect(re.test("lib/main.ts")).toBe(true);
    expect(re.test("lib/main.TS")).toBe(true);
    expect(re.test("lib/main.js")).toBe(false);
  });

  it("supports character classes and negation in classes", () => {
    const cls = globToRegExp("foo/[a-c].txt");
    expect(cls.test("foo/a.txt")).toBe(true);
    expect(cls.test("foo/b.txt")).toBe(true);
    expect(cls.test("foo/d.txt")).toBe(false);

    const neg = globToRegExp("bar/[!a].md");
    expect(neg.test("bar/a.md")).toBe(false);
    expect(neg.test("bar/b.md")).toBe(true);
  });

  it("treats escaped specials literally", () => {
    const re = globToRegExp("a\\[b\\].txt");
    expect(re.test("a[b].txt")).toBe(true);
    expect(re.test("a-b.txt")).toBe(false);
  });
});

describe("expandBraces", () => {
  it("expands simple lists", () => {
    const out = expandBraces("**/*.{ts,tsx,md}");
    expect(out.sort()).toEqual(["**/*.md", "**/*.ts", "**/*.tsx"].sort());
  });

  it("expands nested braces", () => {
    const out = expandBraces("a/{b,{c,d}}/e");
    expect(out.sort()).toEqual(["a/b/e", "a/c/e", "a/d/e"].sort());
  });
});
