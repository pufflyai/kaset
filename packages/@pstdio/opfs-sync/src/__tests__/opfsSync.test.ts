import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { OpfsSync } from "../opfsSync";
import { MockRemoteProvider } from "./MockRemoteProvider";
import { createMockDirectoryHandle, createMockFileHandle } from "./setup";

describe("OpfsSync", () => {
  let mockLocalDir: any;
  let mockRemote: MockRemoteProvider;
  let opfsSync: OpfsSync;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock local directory with some files
    const entries = new Map();
    entries.set("file1.txt", createMockFileHandle("file1.txt", "content1", 1000));
    entries.set("file2.txt", createMockFileHandle("file2.txt", "content2", 2000));

    mockLocalDir = createMockDirectoryHandle("root", entries);
    mockRemote = new MockRemoteProvider();

    opfsSync = new OpfsSync({
      localDir: mockLocalDir,
      remote: mockRemote,
      scanInterval: 0, // Disable automatic scanning for tests
    });
  });

  afterEach(() => {
    opfsSync.stopWatching();
  });

  describe("constructor", () => {
    it("should initialize with provided options", () => {
      expect(opfsSync).toBeInstanceOf(OpfsSync);
      expect(opfsSync.remote).toBe(mockRemote);
    });

    it("should set default scan interval to 0", () => {
      const sync = new OpfsSync({
        localDir: mockLocalDir,
        remote: mockRemote,
      });
      expect(sync).toBeInstanceOf(OpfsSync);
    });
  });

  describe("initialSync", () => {
    it("should upload local files not present remotely", async () => {
      // Local has files, remote is empty
      await opfsSync.initialSync();

      expect(mockRemote.uploadSpy).toHaveBeenCalledTimes(2);
      expect(mockRemote.uploadSpy).toHaveBeenCalledWith("file1.txt", expect.any(File));
      expect(mockRemote.uploadSpy).toHaveBeenCalledWith("file2.txt", expect.any(File));
    });

    it("should download remote files not present locally", async () => {
      // Remote has files, local is empty
      mockRemote.setFile("remote1.txt", "remote content 1", 3000);
      mockRemote.setFile("remote2.txt", "remote content 2", 4000);

      const emptyLocalDir = createMockDirectoryHandle("empty");
      const syncWithEmptyLocal = new OpfsSync({
        localDir: emptyLocalDir,
        remote: mockRemote,
      });

      await syncWithEmptyLocal.initialSync();

      expect(mockRemote.downloadSpy).toHaveBeenCalledTimes(2);
      expect(mockRemote.downloadSpy).toHaveBeenCalledWith("remote1.txt");
      expect(mockRemote.downloadSpy).toHaveBeenCalledWith("remote2.txt");
    });

    it("should use last-writer-wins strategy for conflicts", async () => {
      // Remote file is newer
      mockRemote.setFile("file1.txt", "newer remote content", 5000);

      await opfsSync.initialSync();

      expect(mockRemote.downloadSpy).toHaveBeenCalledWith("file1.txt");
      expect(mockRemote.uploadSpy).not.toHaveBeenCalledWith("file1.txt", expect.anything());
    });

    it("should upload when local file is newer", async () => {
      // Local file is newer (mtime: 2000 vs remote: 500)
      mockRemote.setFile("file2.txt", "older remote content", 500);

      await opfsSync.initialSync();

      expect(mockRemote.uploadSpy).toHaveBeenCalledWith("file2.txt", expect.any(File));
      expect(mockRemote.downloadSpy).not.toHaveBeenCalledWith("file2.txt");
    });

    it("should skip files with matching SHA256", async () => {
      // Mock matching SHA256 hash
      const mockHash = "a".repeat(64); // 64 char hex string
      mockRemote.setFile("file1.txt", "content", 1000, mockHash);

      // Mock crypto.subtle.digest to return consistent hash
      vi.mocked(crypto.subtle.digest).mockResolvedValue(
        new Uint8Array(32).fill(170).buffer, // This will create 'aa' repeated 32 times
      );

      await opfsSync.initialSync();

      expect(mockRemote.uploadSpy).not.toHaveBeenCalledWith("file1.txt", expect.anything());
      expect(mockRemote.downloadSpy).not.toHaveBeenCalledWith("file1.txt");
    });
  });

  describe("event handling", () => {
    it("should dispatch progress events during upload", async () => {
      const progressEvents: any[] = [];
      opfsSync.addEventListener("progress", (event: any) => {
        progressEvents.push(event.detail);
      });

      await opfsSync.initialSync();

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some((e: any) => e.phase === "upload")).toBe(true);
    });

    it("should dispatch progress events during download", async () => {
      mockRemote.setFile("download-test.txt", "content", Date.now());

      const emptyLocalDir = createMockDirectoryHandle("empty");
      const syncWithEmptyLocal = new OpfsSync({
        localDir: emptyLocalDir,
        remote: mockRemote,
      });

      const progressEvents: any[] = [];
      syncWithEmptyLocal.addEventListener("progress", (event: any) => {
        progressEvents.push(event.detail);
      });

      await syncWithEmptyLocal.initialSync();

      expect(progressEvents.some((e: any) => e.phase === "download")).toBe(true);
    });

    it("should dispatch error events on failure", async () => {
      const errorEvents: any[] = [];
      opfsSync.addEventListener("error", (event: any) => {
        errorEvents.push(event.detail);
      });

      // Make remote.upload throw an error
      mockRemote.uploadSpy.mockImplementation(() => {
        throw new Error("Upload failed");
      });

      await opfsSync.initialSync();

      expect(errorEvents.length).toBeGreaterThan(0);
    });
  });

  describe("watching", () => {
    it("should start and stop watching", () => {
      const spy = vi.spyOn(global, "setInterval");
      const clearSpy = vi.spyOn(global, "clearInterval");

      const syncWithInterval = new OpfsSync({
        localDir: mockLocalDir,
        remote: mockRemote,
        scanInterval: 1000,
      });

      syncWithInterval.startWatching();
      expect(spy).toHaveBeenCalledWith(expect.any(Function), 1000);

      syncWithInterval.stopWatching();
      expect(clearSpy).toHaveBeenCalled();
    });

    it("should not start watching when scanInterval is 0", () => {
      const spy = vi.spyOn(global, "setInterval");

      opfsSync.startWatching();
      expect(spy).not.toHaveBeenCalled();
    });

    it("should not start multiple timers", () => {
      const spy = vi.spyOn(global, "setInterval");

      const syncWithInterval = new OpfsSync({
        localDir: mockLocalDir,
        remote: mockRemote,
        scanInterval: 1000,
      });

      syncWithInterval.startWatching();
      syncWithInterval.startWatching();

      expect(spy).toHaveBeenCalledTimes(1);

      syncWithInterval.stopWatching();
    });
  });
});
