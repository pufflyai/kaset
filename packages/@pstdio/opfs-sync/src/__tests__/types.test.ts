import { describe, it, expect } from "vitest";
import type { RemoteObject, RemoteProvider, ProgressEventDetail } from "../types";

describe("Types", () => {
  describe("RemoteObject", () => {
    it("should have required properties", () => {
      const remoteObject: RemoteObject = {
        key: "test-file.txt",
        size: 1024,
        mtimeMs: Date.now(),
      };

      expect(remoteObject.key).toBe("test-file.txt");
      expect(remoteObject.size).toBe(1024);
      expect(typeof remoteObject.mtimeMs).toBe("number");
    });

    it("should allow optional sha256 property", () => {
      const remoteObject: RemoteObject = {
        key: "test-file.txt",
        size: 1024,
        mtimeMs: Date.now(),
        sha256: "abc123",
      };

      expect(remoteObject.sha256).toBe("abc123");
    });
  });

  describe("RemoteProvider interface", () => {
    it("should define all required methods", () => {
      // This is a compile-time test - if the interface changes, this will fail
      const mockProvider: RemoteProvider = {
        list: async () => [],
        upload: async () => {},
        download: async () => new Blob(),
        remove: async () => {},
      };

      expect(typeof mockProvider.list).toBe("function");
      expect(typeof mockProvider.upload).toBe("function");
      expect(typeof mockProvider.download).toBe("function");
      expect(typeof mockProvider.remove).toBe("function");
    });

    it("should allow optional updateAuth method", () => {
      const mockProvider: RemoteProvider = {
        list: async () => [],
        upload: async () => {},
        download: async () => new Blob(),
        remove: async () => {},
        updateAuth: () => {},
      };

      expect(typeof mockProvider.updateAuth).toBe("function");
    });
  });

  describe("ProgressEventDetail", () => {
    it("should support upload phase", () => {
      const detail: ProgressEventDetail = {
        phase: "upload",
        key: "test.txt",
        transferred: 512,
        total: 1024,
      };

      expect(detail.phase).toBe("upload");
      expect(detail.key).toBe("test.txt");
      expect(detail.transferred).toBe(512);
      expect(detail.total).toBe(1024);
    });

    it("should support download phase", () => {
      const detail: ProgressEventDetail = {
        phase: "download",
        key: "test.txt",
        transferred: 256,
        total: 512,
      };

      expect(detail.phase).toBe("download");
    });
  });
});
