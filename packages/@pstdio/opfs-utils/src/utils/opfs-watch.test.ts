import { describe, expect, it, vi } from "vitest";
import { setupTestOPFS } from "../__helpers__/test-opfs";
import { getFs } from "../adapter/fs";
import { watchDirectory } from "./opfs-watch";

describe("watchDirectory polling", () => {
  it("skips emitting the initial snapshot when emitInitial is false", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    const w = await (root as any).getDirectoryHandle("w", { create: true });
    const existing = await w.getFileHandle("existing.txt", { create: true });
    const writable = await existing.createWritable();
    await writable.write("seed");
    await writable.close();

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false },
    );

    await vi.advanceTimersByTimeAsync(10);
    expect(records).toHaveLength(0);

    cleanup();
    vi.useRealTimers();
  });

  it("emits changes on create/modify/delete", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false },
    );

    const fs = await getFs();
    await fs.promises.writeFile("/w/a.txt", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "appeared" && r.path.join("/") === "a.txt")).toBeTruthy();

    records.length = 0;
    await fs.promises.writeFile("/w/a.txt", "22", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "modified" && r.path.join("/") === "a.txt")).toBeTruthy();

    records.length = 0;
    await fs.promises.unlink("/w/a.txt");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "disappeared" && r.path.join("/") === "a.txt")).toBeTruthy();

    cleanup();
    vi.useRealTimers();
  });

  it("emits the initial snapshot when emitInitial is true", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    const w = await (root as any).getDirectoryHandle("w", { create: true });
    const existing = await w.getFileHandle("existing.txt", { create: true });
    const writable = await existing.createWritable();
    await writable.write("seed");
    await writable.close();

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false, emitInitial: true },
    );

    expect(records.find((r) => r.type === "appeared" && r.path.join("/") === "existing.txt")).toBeTruthy();

    cleanup();
    vi.useRealTimers();
  });

  it("ignores files matching ignore regex", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false, ignore: /\.tmp$/ },
    );

    const fs = await getFs();
    await fs.promises.writeFile("/w/ignore.tmp", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.path.join("/") === "ignore.tmp")).toBeFalsy();

    records.length = 0;
    await fs.promises.writeFile("/w/keep.txt", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "appeared" && r.path.join("/") === "keep.txt")).toBeTruthy();

    cleanup();
    vi.useRealTimers();
  });

  it("ignores files when provided an ignore predicate", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      {
        intervalMs: 10,
        pauseWhenHidden: false,
        ignore: (path, handle) => handle.kind === "file" && path.join("/").endsWith(".bak"),
      },
    );

    const fs = await getFs();
    await fs.promises.writeFile("/w/data.bak", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.path.join("/") === "data.bak")).toBeFalsy();

    records.length = 0;
    await fs.promises.writeFile("/w/data.txt", "10", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "appeared" && r.path.join("/") === "data.txt")).toBeTruthy();

    cleanup();
    vi.useRealTimers();
  });

  it("does not traverse subdirectories when recursive is false", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false, recursive: false },
    );

    const fs = await getFs();
    await fs.promises.mkdir("/w/sub");
    await fs.promises.writeFile("/w/sub/child.txt", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);

    expect(records.find((r) => r.path.join("/") === "sub")).toBeTruthy();
    expect(records.find((r) => r.path.join("/") === "sub/child.txt")).toBeFalsy();

    cleanup();
    vi.useRealTimers();
  });

  it("provides metadata for appeared and modified events", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false },
    );

    const fs = await getFs();
    await fs.promises.writeFile("/w/meta.txt", "abc", "utf8");
    await vi.advanceTimersByTimeAsync(20);

    const appeared = records.find((r) => r.type === "appeared" && r.path.join("/") === "meta.txt");
    expect(appeared).toBeTruthy();
    expect(appeared?.handleKind).toBe("file");
    expect(appeared?.size).toBe(3);
    expect(typeof appeared?.lastModified).toBe("number");

    records.length = 0;
    await fs.promises.writeFile("/w/meta.txt", "updated", "utf8");
    await vi.advanceTimersByTimeAsync(20);

    const modified = records.find((r) => r.type === "modified" && r.path.join("/") === "meta.txt");
    expect(modified).toBeTruthy();
    expect(modified?.size).toBe(7);
    expect(typeof modified?.lastModified).toBe("number");

    cleanup();
    vi.useRealTimers();
  });

  it("stops emitting changes after the abort signal fires", async () => {
    setupTestOPFS();
    const root = setupTestOPFS();
    await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    const controller = new AbortController();
    const cleanup = await watchDirectory(
      "w",
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false, signal: controller.signal },
    );

    const fs = await getFs();
    await fs.promises.writeFile("/w/first.txt", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.path.join("/") === "first.txt")).toBeTruthy();

    records.length = 0;
    controller.abort();

    await fs.promises.writeFile("/w/second.txt", "1", "utf8");
    await vi.advanceTimersByTimeAsync(20);
    expect(records).toHaveLength(0);

    cleanup();
    vi.useRealTimers();
  });
});
