import * as fs from "fs";
import { promises as fsp } from "fs";
import * as git from "isomorphic-git";
import * as path from "path";
import { describe, expect, it } from "vitest";

import { commitAll, ensureRepo, getRepoStatus, listCommits, type GitContext } from "./opfs-git";

async function makeTempRepoDir(prefix = "opfs-git-test-") {
  const base = path.join(process.cwd(), ".tmp-tests");
  await fsp.mkdir(base, { recursive: true });
  const dir = await fsp.mkdtemp(path.join(base, prefix));
  return dir;
}

function ctxFor(dir: string): GitContext {
  return { git, fs, dir } as unknown as GitContext;
}

describe("ensureRepo", () => {
  it("initializes a new repo with default branch and config", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);

    const first = await ensureRepo(ctx, { name: "Test User", email: "test@example.com" });
    expect(first.created).toBe(true);
    expect(first.currentBranch).toBe("main");

    // .git folder exists
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);

    // Config stored (best-effort)
    const userName = await git.getConfig({ fs, dir, path: "user.name" }).catch(() => undefined);
    const userEmail = await git.getConfig({ fs, dir, path: "user.email" }).catch(() => undefined);
    expect(userName).toBe("Test User");
    expect(userEmail).toBe("test@example.com");

    const second = await ensureRepo(ctx);
    expect(second.created).toBe(false);
    expect(second.currentBranch).toBe("main");
  });
});

describe("getRepoStatus", () => {
  it("detects untracked files", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await ensureRepo(ctx);

    // Initially empty
    let status = await getRepoStatus(ctx);
    expect(status).toEqual({ added: [], modified: [], deleted: [], untracked: [] });

    // Create an untracked file
    const aPath = path.join(dir, "a.txt");
    await fsp.writeFile(aPath, "hello");

    status = await getRepoStatus(ctx);
    expect(status.untracked).toContain("a.txt");

    // Stage + commit once
    await commitAll(ctx, {
      message: "add a.txt",
      author: { name: "T", email: "t@e" },
    });

    // Only verify untracked detection here; modification/deletion are exercised indirectly by commitAll
  });
});

describe("commitAll", () => {
  it("commits added and modified files", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await ensureRepo(ctx);

    await fsp.writeFile(path.join(dir, "a.txt"), "v1");
    const res1 = await commitAll(ctx, {
      message: "init",
      author: { name: "U", email: "u@e" },
    });
    expect(typeof res1.oid).toBe("string");
    expect(res1.added).toContain("a.txt");
    expect(res1.deleted.length).toBe(0);

    // Modify existing file and add a new one
    await fsp.writeFile(path.join(dir, "a.txt"), "v2");
    await fsp.writeFile(path.join(dir, "new.txt"), "n");

    const res2 = await commitAll(ctx, {
      message: "update",
      author: { name: "U", email: "u@e" },
    });
    expect(typeof res2.oid).toBe("string");
    // commitAll returns all to-be-added/staged changes under `added`
    // (untracked + modified + added)
    expect(res2.added).toEqual(expect.arrayContaining(["new.txt", "a.txt"]));
    expect(res2.deleted.length).toBe(0);
  });

  it("dry-run does not stage or create commits", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await ensureRepo(ctx);

    // One baseline commit
    await fsp.writeFile(path.join(dir, "base.txt"), "b");
    await commitAll(ctx, { message: "base", author: { name: "U", email: "u@e" } });

    // Introduce a new file
    await fsp.writeFile(path.join(dir, "temp.txt"), "t");

    const res = await commitAll(ctx, {
      message: "would commit",
      author: { name: "U", email: "u@e" },
      dryRun: true,
    });

    expect(res.oid).toBeNull();
    expect(res.dryRun).toBe(true);
    expect(res.added).toContain("temp.txt");

    // Verify no new commit was added
    const log = await git.log({ fs, dir, ref: (await git.currentBranch({ fs, dir, fullname: false })) ?? "HEAD" });
    expect(log[0]?.commit?.message?.trim()).toBe("base");

    // And file is still untracked (not staged via dryRun)
    const status = await getRepoStatus(ctx);
    expect(status.untracked).toContain("temp.txt");
  });
});

describe("listCommits", () => {
  it("lists recent commits with limit and ref", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await ensureRepo(ctx);

    await fsp.writeFile(path.join(dir, "a.txt"), "1");
    await commitAll(ctx, { message: "c1", author: { name: "U", email: "u@e" } });
    await fsp.writeFile(path.join(dir, "b.txt"), "2");
    await commitAll(ctx, { message: "c2", author: { name: "U", email: "u@e" } });
    await fsp.writeFile(path.join(dir, "c.txt"), "3");
    await commitAll(ctx, { message: "c3", author: { name: "U", email: "u@e" } });

    const entries = await listCommits(ctx, { limit: 2 });
    expect(entries.length).toBe(2);
    expect(entries[0].message).toBe("c3");
    expect(entries[1].message).toBe("c2");
    expect(typeof entries[0].isoDate === "string" || entries[0].isoDate === undefined).toBe(true);

    // Commit to another branch and list from it
    await fsp.writeFile(path.join(dir, "feature.txt"), "f");
    await commitAll(ctx, { message: "feat", author: { name: "U", email: "u@e" }, branch: "feature" });
    const feature = await listCommits(ctx, { ref: "feature", limit: 1 });
    expect(feature[0].message).toBe("feat");
  });
});
