import { describe, expect, it, vi } from "vitest";
import { setupTestOPFS, writeFile } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../shared";
import { watchDirectory } from "./opfs-watch";

describe("watchDirectory polling", () => {
  it("emits changes on create/modify/delete", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();
    const dir = await (root as any).getDirectoryHandle("w", { create: true });

    const records: any[] = [];

    vi.useFakeTimers();
    await watchDirectory(
      dir,
      (c) => {
        records.push(...c);
      },
      { intervalMs: 10, pauseWhenHidden: false },
    );

    await writeFile(dir, "a.txt", "1");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "appeared" && r.path.join("/") === "a.txt")).toBeTruthy();

    records.length = 0;
    await writeFile(dir, "a.txt", "22");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "modified" && r.path.join("/") === "a.txt")).toBeTruthy();

    records.length = 0;
    await dir.removeEntry("a.txt");
    await vi.advanceTimersByTimeAsync(20);
    expect(records.find((r) => r.type === "disappeared" && r.path.join("/") === "a.txt")).toBeTruthy();

    vi.useRealTimers();
  });
});
