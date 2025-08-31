import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpfsSync } from "../opfsSync";
import { MockRemoteProvider } from "./MockRemoteProvider";

// Simple mock for File System Access API
const createSimpleMockDirectory = () => {
  const files = new Map();

  return {
    name: "test-dir",
    kind: "directory" as const,
    values: vi.fn(function* () {
      for (const [name, content] of files.entries()) {
        yield {
          name,
          kind: "file",
          getFile: () => Promise.resolve(new File([content], name, { lastModified: Date.now() })),
        };
      }
    }),
    getFileHandle: vi.fn((name: string) =>
      Promise.resolve({
        name,
        kind: "file",
        getFile: () => Promise.resolve(new File(["test content"], name, { lastModified: Date.now() })),
        createWritable: () =>
          Promise.resolve({
            write: vi.fn(),
            close: vi.fn(),
          }),
      }),
    ),
    getDirectoryHandle: vi.fn(),
    removeEntry: vi.fn(),
    resolve: vi.fn(),
    isSameEntry: vi.fn(),

    // Test helper
    addFile: (name: string, content: string) => files.set(name, content),
  } as any;
};

describe("OpfsSync - Integration Tests", () => {
  let mockLocalDir: any;
  let mockRemote: MockRemoteProvider;
  let opfsSync: OpfsSync;

  beforeEach(() => {
    mockLocalDir = createSimpleMockDirectory();
    mockRemote = new MockRemoteProvider();

    opfsSync = new OpfsSync({
      localDir: mockLocalDir,
      remote: mockRemote,
      scanInterval: 0,
    });
  });

  describe("basic functionality", () => {
    it("should create OpfsSync instance", () => {
      expect(opfsSync).toBeInstanceOf(OpfsSync);
      expect(opfsSync.remote).toBe(mockRemote);
    });

    it("should handle empty sync", async () => {
      await opfsSync.initialSync();
      expect(mockRemote.listSpy).toHaveBeenCalled();
    });

    it("should emit progress events", async () => {
      mockLocalDir.addFile("test.txt", "content");

      const progressEvents: any[] = [];
      opfsSync.addEventListener("progress", (event: any) => {
        progressEvents.push(event.detail);
      });

      await opfsSync.initialSync();

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0]).toHaveProperty("phase");
      expect(progressEvents[0]).toHaveProperty("key");
      expect(progressEvents[0]).toHaveProperty("transferred");
      expect(progressEvents[0]).toHaveProperty("total");
    });
  });

  describe("watching", () => {
    it("should start and stop watching with interval", () => {
      const syncWithInterval = new OpfsSync({
        localDir: mockLocalDir,
        remote: mockRemote,
        scanInterval: 1000,
      });

      const setIntervalSpy = vi.spyOn(global, "setInterval");
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      syncWithInterval.startWatching();
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);

      syncWithInterval.stopWatching();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("should not watch when interval is 0", () => {
      const setIntervalSpy = vi.spyOn(global, "setInterval");

      opfsSync.startWatching();
      expect(setIntervalSpy).not.toHaveBeenCalled();
    });
  });
});
