import { describe, expect, it, vi } from "vitest";
import { setupTestOPFS, writeFile } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../__helpers__/test-opfs";
import { runOpfsCommandLine } from "./opfs-shell";

async function seedBasicTree() {
  setupTestOPFS();

  const root = await getOPFSRoot();

  await writeFile(root, "README.md", "hello world\nbye\n");
  await writeFile(root, "docs/notes.txt", "alpha\nbeta\ngamma\n");
  await writeFile(root, "docs/Upper.md", "Hello Universe\n");
  await writeFile(root, "dir/sub/file.txt", "one\ntwo\nthree\n");
  await writeFile(root, ".hidden/secret.txt", "shh\n");

  return root;
}

describe("opfs-shell: ls", () => {
  it("lists directory contents (no hidden by default)", async () => {
    const root = await seedBasicTree();

    const { stdout, code, stderr } = await runOpfsCommandLine("ls .", { root });

    const lines = stdout.trim().split("\n");
    expect(code).toBe(0);
    expect(stderr).toBe("");

    // Hidden dir is not listed without -a
    expect(lines).toEqual(expect.arrayContaining(["README.md", "dir", "docs"]));
    expect(lines).not.toContain(".hidden");
  });

  it("includes hidden entries with -a and supports -R for recursion", async () => {
    const root = await seedBasicTree();

    const { stdout } = await runOpfsCommandLine("ls -a -R .", { root });
    const lines = stdout.trim().split("\n");

    expect(lines).toEqual(
      expect.arrayContaining([".hidden", "docs", "dir", "README.md", "dir/sub", "dir/sub/file.txt", "docs/notes.txt"]),
    );
  });

  it("prints long listing for a file with -l", async () => {
    // Freeze time so File lastModified becomes deterministic
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const root = await seedBasicTree();

    const { stdout } = await runOpfsCommandLine("ls -l README.md", { root });

    // Example: "-     12 B  1970-01-01 00:00  README.md"
    expect(stdout).toMatch(/^-[\s\S]*README\.md\n?$/);

    vi.useRealTimers();
  });
});

describe("opfs-shell: sed", () => {
  it("prints a single line from a file", async () => {
    const root = await seedBasicTree();

    const { stdout, code } = await runOpfsCommandLine("sed -n '2p' docs/notes.txt", { root });
    expect(code).toBe(0);
    expect(stdout.trim()).toBe("beta");
  });

  it("operates on stdin when no file is provided", async () => {
    const root = await seedBasicTree();

    const { stdout } = await runOpfsCommandLine('ls . | sed -n "1p"', { root });
    const first = stdout.trim().split("\n")[0];
    expect(first.length).toBeGreaterThan(0);
  });
});

describe("opfs-shell: echo", () => {
  it("prints joined arguments", async () => {
    const root = await seedBasicTree();
    const { stdout, code, stderr } = await runOpfsCommandLine("echo hello world", { root });
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout.trim()).toBe("hello world");
  });

  it("supports quoted strings and piping to sed", async () => {
    const root = await seedBasicTree();
    const { stdout } = await runOpfsCommandLine('echo "alpha beta" | sed -n "1p"', { root });
    expect(stdout.trim()).toBe("alpha beta");
  });
});

describe("opfs-shell: rg", () => {
  it("finds matches with and without -n", async () => {
    const root = await seedBasicTree();

    let res = await runOpfsCommandLine("rg 'world' .", { root });
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("README.md:");
    // default format includes matched substring
    expect(res.stdout).toMatch(/README\.md:\d+:\d+: world/);

    res = await runOpfsCommandLine('rg -n "alpha|beta" docs', { root });
    expect(res.code).toBe(0);
    // -n prints the entire line text. Path may be relative to the search dir.
    expect(res.stdout).toMatch(/(?:docs\/)?notes\.txt:1:\d+: alpha/);
    expect(res.stdout).toMatch(/(?:docs\/)?notes\.txt:2:\d+: beta/);
  });

  it("respects -S smart-case for case-insensitive matches only when pattern has no uppercase", async () => {
    const root = await seedBasicTree();

    // Without -S: lowercase pattern does not match 'Hello'
    let res = await runOpfsCommandLine("rg 'hello' .", { root });
    expect(res.stdout).toMatch(/README\.md:\d+:\d+: hello/);
    expect(res.stdout).not.toMatch(/Upper\.md/);

    // With -S and lowercase pattern: should match 'Hello' too
    res = await runOpfsCommandLine("rg -S 'hello' .", { root });
    expect(res.stdout).toMatch(/README\.md:/);
    expect(res.stdout).toMatch(/docs\/Upper\.md:/);

    // With -S but uppercase in pattern: stays case-sensitive
    res = await runOpfsCommandLine("rg -S 'Hello' .", { root });
    expect(res.stdout).toMatch(/docs\/Upper\.md:/);
    expect(res.stdout).not.toMatch(/README\.md:/);
  });

  it("handles zero-length regex matches without infinite loops", async () => {
    const root = await seedBasicTree();
    // Pattern 'a*' can match at many positions including empty; ensure it completes
    const res = await runOpfsCommandLine("rg 'a*' .", { root });
    expect(res.code).toBe(0);
    expect(typeof res.stdout).toBe("string");
  });
});

describe("opfs-shell: find", () => {
  it("finds files by -name and honors -type/-depth", async () => {
    const root = await seedBasicTree();

    // By name across tree (includes hidden directory file)
    let res = await runOpfsCommandLine("find . -name '*.txt'", { root });
    const lines = res.stdout.trim().split("\n");
    expect(lines).toEqual(expect.arrayContaining(["docs/notes.txt", "dir/sub/file.txt", ".hidden/secret.txt"]));

    // Limit to files under docs only (depth 1)
    res = await runOpfsCommandLine("find docs -type f -maxdepth 1", { root });
    const docsFiles = res.stdout.trim().split("\n").filter(Boolean);
    expect(docsFiles).toEqual(expect.arrayContaining(["docs/notes.txt", "docs/Upper.md"]));

    // File input prints itself
    res = await runOpfsCommandLine("find README.md", { root });
    expect(res.stdout.trim()).toBe("README.md");
  });
});

describe("opfs-shell: wc", () => {
  it("counts lines/words/bytes for files and stdin", async () => {
    const root = await seedBasicTree();

    // README.md has: "hello world\nbye\n" => lines=2, words=3, bytes=16
    let res = await runOpfsCommandLine("wc -l README.md", { root });
    expect(res.stdout.trim()).toBe("2\tREADME.md");

    res = await runOpfsCommandLine("wc -w README.md", { root });
    expect(res.stdout.trim()).toBe("3\tREADME.md");

    res = await runOpfsCommandLine("wc -c README.md", { root });
    expect(res.stdout.trim()).toBe("16\tREADME.md");

    // stdin
    res = await runOpfsCommandLine('echo "alpha beta gamma" | wc -w', { root });
    expect(res.stdout.trim()).toBe("3");

    // Multiple files -> total line present
    res = await runOpfsCommandLine("wc -l README.md docs/notes.txt", { root });
    const out = res.stdout.trim().split("\n");
    expect(out.length).toBe(3);
    expect(out[0]).toMatch(/^2\tREADME\.md$/);
    expect(out[1]).toMatch(/^3\tdocs\/notes\.txt$/);
    expect(out[2]).toMatch(/^5\ttotal$/);
  });
});

describe("opfs-shell: piping, sequences, cwd, and errors", () => {
  it("pipes output between stages and streams via onChunk", async () => {
    const root = await seedBasicTree();

    const chunks: string[] = [];
    const { stdout } = await runOpfsCommandLine("ls . | sed -n '1p' && rg 'hello' .", {
      root,
      onChunk: (s) => chunks.push(s),
    });

    // Two sequences => two onChunk calls
    expect(chunks.length).toBe(2);
    expect(chunks[0].length).toBeGreaterThan(0);
    expect(chunks[1]).toContain("README.md:");

    // Overall stdout should contain both outputs, separated by newlines
    expect(stdout).toContain(chunks[0]);
    expect(stdout).toContain(chunks[1]);
  });

  it("resolves relative paths against cwd", async () => {
    const root = await seedBasicTree();

    const { stdout } = await runOpfsCommandLine("ls .", { root, cwd: "dir" });
    const lines = stdout.trim().split("\n");

    expect(lines).toContain("sub");
    expect(lines).not.toContain("README.md");
  });

  it("returns 127 for unknown commands", async () => {
    const root = await seedBasicTree();

    const res = await runOpfsCommandLine("unknowncmd", { root });
    expect(res.code).toBe(127);
    expect(res.stderr).toContain("Unknown command: unknowncmd");
  });

  it("does not call onChunk when a sequence yields no output", async () => {
    const root = await seedBasicTree();
    const chunks: string[] = [];
    const res = await runOpfsCommandLine("rg 'NO_MATCH_STRING' .", { root, onChunk: (s) => chunks.push(s) });
    expect(res.stdout.trim()).toBe("");
    expect(chunks).toHaveLength(0);
  });

  it("short-circuits on unknown command in a sequence (no subsequent stages)", async () => {
    const root = await seedBasicTree();
    const res = await runOpfsCommandLine("unknown && ls .", { root });
    expect(res.code).toBe(127);
    expect(res.stderr).toContain("Unknown command");
  });
});

describe("opfs-shell: sed edge cases", () => {
  it("prints a range from a file", async () => {
    const root = await seedBasicTree();
    const res = await runOpfsCommandLine("sed -n '1,2p' docs/notes.txt", { root });
    expect(res.stdout.trim()).toBe(["alpha", "beta"].join("\n"));
  });

  it("throws on missing script", async () => {
    const root = await seedBasicTree();
    await expect(runOpfsCommandLine("sed", { root })).rejects.toThrow(/sed: missing script/);
  });

  it("throws on unsupported script", async () => {
    const root = await seedBasicTree();
    await expect(runOpfsCommandLine("sed -n '1,2d' docs/notes.txt", { root })).rejects.toThrow(
      /sed: unsupported script/,
    );
  });

  it("returns empty string when range is outside file length", async () => {
    const root = await seedBasicTree();
    const res = await runOpfsCommandLine("sed -n '100p' README.md", { root });
    expect(res.stdout).toBe("");
  });
});

describe("opfs-shell: nl", () => {
  it("numbers non-empty lines by default (-bt)", async () => {
    const root = await seedBasicTree();
    await writeFile(root, "docs/nl.txt", "alpha\n\nbeta\n");

    const res = await runOpfsCommandLine("nl docs/nl.txt", { root });
    const lines = res.stdout.replace(/\n$/, "").split("\n");

    expect(lines).toEqual(["     1\talpha", "", "     2\tbeta"]);
  });

  it("numbers all lines with -ba", async () => {
    const root = await seedBasicTree();
    await writeFile(root, "docs/nl2.txt", "alpha\n\nbeta\n");

    const res = await runOpfsCommandLine("nl -ba docs/nl2.txt", { root });
    const lines = res.stdout.replace(/\n$/, "").split("\n");

    expect(lines).toEqual(["     1\talpha", "     2\t", "     3\tbeta"]);
  });

  it("supports custom width and separator (-w, -s) and stdin input", async () => {
    const root = await seedBasicTree();
    const cmd = 'echo "x\ny" | nl -ba -w 3 -s " "';
    const res = await runOpfsCommandLine(cmd, { root });
    const lines = res.stdout.replace(/\n$/, "").split("\n");

    expect(lines).toEqual(["  1 x", "  2 y"]);
  });

  it("pipes to sed line range: nl -ba todos/todo.md | sed -n '1,200p'", async () => {
    const root = await seedBasicTree();
    await writeFile(root, "todos/todo.md", "one\ntwo\nthree\n");

    const piped = await runOpfsCommandLine("nl -ba todos/todo.md | sed -n '1,200p'", { root });
    const direct = await runOpfsCommandLine("nl -ba todos/todo.md", { root });

    expect(piped.stdout.replace(/\n$/, "")).toBe(direct.stdout.replace(/\n$/, ""));
  });
});

describe("opfs-shell: ls edge cases", () => {
  it("returns bare filename when targeting a single file", async () => {
    const root = await seedBasicTree();
    const res = await runOpfsCommandLine("ls docs/notes.txt", { root });
    expect(res.stdout.trim()).toBe("notes.txt");
  });

  it("-l matches a literal filename containing glob characters", async () => {
    const root = await seedBasicTree();
    await writeFile(root, "weird/a[b]c?{x}.txt", "x");
    const res = await runOpfsCommandLine("ls -l weird/a[b]c?{x}.txt", { root });
    const out = res.stdout.trim();
    // Expect a single long-format line ending with the literal filename
    expect(out).toMatch(/^-/);
    expect(out).toMatch(/\b1 B\b/);
    expect(out.endsWith("a[b]c?{x}.txt")).toBe(true);
  });

  it("does not support parent directory '..' in paths (documents current behavior)", async () => {
    const root = await seedBasicTree();
    await expect(runOpfsCommandLine("ls ..", { root, cwd: "docs" })).rejects.toBeTruthy();
  });
});
