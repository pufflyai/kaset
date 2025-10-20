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
});
