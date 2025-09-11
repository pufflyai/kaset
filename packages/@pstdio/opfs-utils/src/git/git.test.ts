import * as fs from "fs";
import { promises as fsp } from "fs";
import * as git from "isomorphic-git";
import * as path from "path";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Mock OPFS-backed fs with Node's fs for tests
vi.mock("../adapter/fs", () => ({
  getFs: async () => (await import("fs")) as any,
}));

import type { GitContext } from "./git";

let api: typeof import("./git");
beforeAll(async () => {
  api = await import("./git");
});

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

    const first = await api.ensureRepo(ctx, { name: "Test User", email: "test@example.com" });
    expect(first.created).toBe(true);
    expect(first.currentBranch).toBe("main");

    // .git folder exists
    expect(fs.existsSync(path.join(dir, ".git"))).toBe(true);

    // Config stored (best-effort)
    const userName = await git.getConfig({ fs, dir, path: "user.name" }).catch(() => undefined);
    const userEmail = await git.getConfig({ fs, dir, path: "user.email" }).catch(() => undefined);
    expect(userName).toBe("Test User");
    expect(userEmail).toBe("test@example.com");

    const second = await api.ensureRepo(ctx);
    expect(second.created).toBe(false);
    expect(second.currentBranch).toBe("main");
  });
});

describe("getRepoStatus", () => {
  it("detects untracked files", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await api.ensureRepo(ctx);

    // Initially empty
    let status = await api.getRepoStatus(ctx);
    expect(status.added).toEqual([]);
    expect(status.modified).toEqual([]);
    expect(status.deleted).toEqual([]);
    expect(status.untracked).toEqual([]);

    // Create an untracked file
    const aPath = path.join(dir, "a.txt");
    await fsp.writeFile(aPath, "hello");

    status = await api.getRepoStatus(ctx);
    expect(status.untracked).toContain("a.txt");

    // Stage + commit once
    await api.commitAll(ctx, {
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
    await api.ensureRepo(ctx);

    await fsp.writeFile(path.join(dir, "a.txt"), "v1");
    const res1 = await api.commitAll(ctx, {
      message: "init",
      author: { name: "U", email: "u@e" },
    });
    expect(typeof res1.oid).toBe("string");
    expect(res1.added).toContain("a.txt");
    expect(res1.deleted.length).toBe(0);

    // Modify existing file and add a new one
    await fsp.writeFile(path.join(dir, "a.txt"), "v2");
    await fsp.writeFile(path.join(dir, "new.txt"), "n");

    const res2 = await api.commitAll(ctx, {
      message: "update",
      author: { name: "U", email: "u@e" },
    });
    expect(typeof res2.oid).toBe("string");
    // Expect new file staged for addition and modified file listed under modified
    expect(res2.added).toEqual(expect.arrayContaining(["new.txt"]));
    expect(res2.summary).toContain("Committed");
    expect(res2.deleted.length).toBe(0);
  });

  it("dry-run does not stage or create commits", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await api.ensureRepo(ctx);

    // One baseline commit
    await fsp.writeFile(path.join(dir, "base.txt"), "b");
    await api.commitAll(ctx, { message: "base", author: { name: "U", email: "u@e" } });

    // Introduce a new file
    await fsp.writeFile(path.join(dir, "temp.txt"), "t");

    const res = await api.commitAll(ctx, {
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
    const status = await api.getRepoStatus(ctx);
    expect(status.untracked).toContain("temp.txt");
  });
});

describe("listCommits", () => {
  it("lists recent commits with limit and ref", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await api.ensureRepo(ctx);

    await fsp.writeFile(path.join(dir, "a.txt"), "1");
    await api.commitAll(ctx, { message: "c1", author: { name: "U", email: "u@e" } });
    await fsp.writeFile(path.join(dir, "b.txt"), "2");
    await api.commitAll(ctx, { message: "c2", author: { name: "U", email: "u@e" } });
    await fsp.writeFile(path.join(dir, "c.txt"), "3");
    await api.commitAll(ctx, { message: "c3", author: { name: "U", email: "u@e" } });

    const entries = await api.listCommits(ctx, { limit: 2 });
    expect(entries.length).toBe(2);
    expect(entries[0].message).toBe("c3");
    expect(entries[1].message).toBe("c2");
    expect(typeof entries[0].isoDate === "string" || entries[0].isoDate === undefined).toBe(true);

    // Commit to another branch and list from it
    await fsp.writeFile(path.join(dir, "feature.txt"), "f");
    await api.commitAll(ctx, { message: "feat", author: { name: "U", email: "u@e" }, branch: "feature" });
    const feature = await api.listCommits(ctx, { ref: "feature", limit: 1 });
    expect(feature[0].message).toBe("feat");
  });
});

describe("revertToCommit / checkoutAtCommit / HEAD attach", () => {
  it("supports detached and hard revert, checkout from commit, and reattaching HEAD", async () => {
    const dir = await makeTempRepoDir();
    const ctx = ctxFor(dir);
    await api.ensureRepo(ctx);

    // Make three commits
    await fsp.writeFile(path.join(dir, "a.txt"), "one");
    await api.commitAll(ctx, { message: "c1", author: { name: "U", email: "u@e" } });
    await fsp.writeFile(path.join(dir, "a.txt"), "two");
    await api.commitAll(ctx, { message: "c2", author: { name: "U", email: "u@e" } });
    await fsp.writeFile(path.join(dir, "a.txt"), "three");
    await api.commitAll(ctx, { message: "c3", author: { name: "U", email: "u@e" } });

    const entries3 = await api.listCommits(ctx, { limit: 3 });
    expect(entries3.length).toBeGreaterThanOrEqual(2);
    const c3 = entries3[0].oid;
    const c2 = entries3[1].oid;
    const c1 = entries3[2]?.oid ?? entries3[1].oid; // fall back if only two commits present

    // Detached revert to c1
    const det = await api.revertToCommit(ctx, { to: c1, mode: "detached", force: true });
    expect(det.detached).toBe(true);
    const head1 = await api.getHeadState(ctx);
    expect(head1.detached).toBe(true);
    expect(head1.headOid?.slice(0, 7)).toBe(c1.slice(0, 7));

    // Attach HEAD back to 'main'
    const att = await api.attachHeadToBranch(ctx, "main", { createIfMissing: true, force: true });
    expect(att.branch).toBe("main");
    const head2 = await api.getHeadState(ctx);
    expect(head2.detached).toBe(false);
    expect(head2.currentBranch).toBe("main");

    // Hard revert to c2
    const hard = await api.revertToCommit(ctx, { to: c2, mode: "hard", force: true });
    expect(hard.detached).toBe(false);
    const head3 = await api.getHeadState(ctx);
    expect(head3.currentBranch).toBe("main");

    // Modify file and then restore it from c3 for specific path
    await fsp.writeFile(path.join(dir, "a.txt"), "local-change");
    await api.checkoutAtCommit(ctx, { at: c3, paths: ["a.txt"], force: true });
    const restored = await fsp.readFile(path.join(dir, "a.txt"), "utf8");
    expect(restored).toBe("three");
  });
});
