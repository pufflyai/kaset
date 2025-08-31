import { describe, it, expect, beforeEach, vi } from "vitest";
import { SupabaseRemote } from "../../remotes/supabase";

// Mock Supabase client
const mockStorage = {
  list: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
};

const mockSupabaseClient = {
  storage: {
    from: vi.fn(() => mockStorage),
  },
  auth: {
    setSession: vi.fn(),
  },
};

describe("SupabaseRemote", () => {
  let supabaseRemote: SupabaseRemote;

  beforeEach(() => {
    vi.clearAllMocks();
    supabaseRemote = new SupabaseRemote(mockSupabaseClient as any, "test-bucket", "test-prefix/");
  });

  describe("constructor", () => {
    it("should initialize with provided parameters", () => {
      expect(supabaseRemote).toBeInstanceOf(SupabaseRemote);
    });

    it("should work with empty prefix", () => {
      const remote = new SupabaseRemote(mockSupabaseClient as any, "test-bucket");
      expect(remote).toBeInstanceOf(SupabaseRemote);
    });
  });

  describe("list", () => {
    it("should list files with correct prefix", async () => {
      mockStorage.list.mockResolvedValue({
        data: [
          {
            name: "file1.txt",
            updated_at: "2023-01-01T00:00:00Z",
            metadata: { size: 100 },
          },
          {
            name: "file2.txt",
            updated_at: "2023-01-02T00:00:00Z",
            metadata: { size: 200 },
          },
        ],
        error: null,
      });

      const result = await supabaseRemote.list();

      expect(mockStorage.list).toHaveBeenCalledWith("test-prefix/", { limit: 1000, offset: 0 });
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        key: "file1.txt",
        size: 100,
        mtimeMs: Date.parse("2023-01-01T00:00:00Z"),
      });
    });

    it("should handle directories recursively", async () => {
      mockStorage.list
        .mockResolvedValueOnce({
          data: [
            { name: "subdir", metadata: undefined }, // Directory
            { name: "file1.txt", updated_at: "2023-01-01T00:00:00Z", metadata: { size: 100 } },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [{ name: "nested.txt", updated_at: "2023-01-03T00:00:00Z", metadata: { size: 300 } }],
          error: null,
        });

      const result = await supabaseRemote.list();

      expect(mockStorage.list).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result.find((f: any) => f.key === "file1.txt")).toBeDefined();
      expect(result.find((f: any) => f.key === "subdir/nested.txt")).toBeDefined();
    });

    it("should handle errors", async () => {
      mockStorage.list.mockResolvedValue({
        data: null,
        error: new Error("List failed"),
      });

      await expect(supabaseRemote.list()).rejects.toThrow("List failed");
    });

    it("should filter by prefix parameter", async () => {
      mockStorage.list.mockResolvedValue({
        data: [{ name: "matching.txt", updated_at: "2023-01-01T00:00:00Z", metadata: { size: 100 } }],
        error: null,
      });

      await supabaseRemote.list("sub/");

      expect(mockStorage.list).toHaveBeenCalledWith("test-prefix/sub/", { limit: 1000, offset: 0 });
    });
  });

  describe("upload", () => {
    it("should upload blob data", async () => {
      mockStorage.upload.mockResolvedValue({ error: null });
      const blob = new Blob(["test content"], { type: "text/plain" });

      await supabaseRemote.upload("test.txt", blob);

      expect(mockStorage.upload).toHaveBeenCalledWith("test-prefix/test.txt", blob, { upsert: true });
    });

    it("should convert ReadableStream to Blob", async () => {
      mockStorage.upload.mockResolvedValue({ error: null });
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("stream content"));
          controller.close();
        },
      });

      await supabaseRemote.upload("test.txt", stream);

      expect(mockStorage.upload).toHaveBeenCalledWith("test-prefix/test.txt", expect.any(Blob), { upsert: true });
    });

    it("should handle upload errors", async () => {
      mockStorage.upload.mockResolvedValue({ error: new Error("Upload failed") });
      const blob = new Blob(["test"], { type: "text/plain" });

      await expect(supabaseRemote.upload("test.txt", blob)).rejects.toThrow("Upload failed");
    });
  });

  describe("download", () => {
    it("should download file as blob", async () => {
      const mockBlob = new Blob(["downloaded content"], { type: "text/plain" });
      mockStorage.download.mockResolvedValue({ data: mockBlob, error: null });

      const result = await supabaseRemote.download("test.txt");

      expect(mockStorage.download).toHaveBeenCalledWith("test-prefix/test.txt");
      expect(result).toBe(mockBlob);
    });

    it("should handle download errors", async () => {
      mockStorage.download.mockResolvedValue({ data: null, error: new Error("Download failed") });

      await expect(supabaseRemote.download("test.txt")).rejects.toThrow("Download failed");
    });

    it("should handle missing file", async () => {
      mockStorage.download.mockResolvedValue({ data: null, error: null });

      await expect(supabaseRemote.download("nonexistent.txt")).rejects.toBeTruthy();
    });
  });

  describe("remove", () => {
    it("should remove file", async () => {
      mockStorage.remove.mockResolvedValue({ error: null });

      await supabaseRemote.remove("test.txt");

      expect(mockStorage.remove).toHaveBeenCalledWith(["test-prefix/test.txt"]);
    });

    it("should handle removal errors", async () => {
      mockStorage.remove.mockResolvedValue({ error: new Error("Remove failed") });

      await expect(supabaseRemote.remove("test.txt")).rejects.toThrow("Remove failed");
    });
  });

  describe("updateAuth", () => {
    it("should update auth with token", () => {
      supabaseRemote.updateAuth("new-token");

      expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledWith({
        access_token: "new-token",
        refresh_token: "new-token",
      });
    });

    it("should clear auth when no token provided", () => {
      supabaseRemote.updateAuth();

      expect(mockSupabaseClient.auth.setSession).toHaveBeenCalledWith({
        access_token: "",
        refresh_token: "",
      });
    });

    it("should handle auth errors gracefully", () => {
      mockSupabaseClient.auth.setSession.mockImplementation(() => {
        throw new Error("Auth failed");
      });

      // Should not throw
      expect(() => supabaseRemote.updateAuth("token")).not.toThrow();
    });
  });

  describe("fullPath helper", () => {
    it("should combine prefix and key correctly", async () => {
      mockStorage.upload.mockResolvedValue({ error: null });
      const blob = new Blob(["test"], { type: "text/plain" });

      await supabaseRemote.upload("subdir/file.txt", blob);

      expect(mockStorage.upload).toHaveBeenCalledWith("test-prefix/subdir/file.txt", blob, { upsert: true });
    });

    it("should handle leading slashes in key", async () => {
      mockStorage.upload.mockResolvedValue({ error: null });
      const blob = new Blob(["test"], { type: "text/plain" });

      await supabaseRemote.upload("/file.txt", blob);

      expect(mockStorage.upload).toHaveBeenCalledWith("test-prefix/file.txt", blob, { upsert: true });
    });
  });
});
