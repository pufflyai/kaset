import { describe, expect, it } from "vitest";
import { setupTestOPFS } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../shared";
import { readFile, writeFile, deleteFile } from "./opfs-crud";

describe("opfs-crud (node env)", () => {
  it("write -> read roundtrip", async () => {
    setupTestOPFS();

    await writeFile("alpha/beta/hello.txt", "hi");
    await expect(readFile("alpha/beta/hello.txt")).resolves.toBe("hi");
  });

  it("delete removes the file", async () => {
    setupTestOPFS();

    await writeFile("x/y/z.txt", "zap");
    await deleteFile("x/y/z.txt");
    await expect(readFile("x/y/z.txt")).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("reading a missing file rejects with NotFoundError", async () => {
    setupTestOPFS();

    await expect(readFile("missing.txt")).rejects.toMatchObject({ name: "NotFoundError" });
  });

  it("writes create parent directories", async () => {
    setupTestOPFS();

    await writeFile("nested/dir/leaf.txt", "content");

    const root = await getOPFSRoot();
    const d1 = await (root as any).getDirectoryHandle("nested");
    const d2 = await d1.getDirectoryHandle("dir");
    const fh = await d2.getFileHandle("leaf.txt");
    const text = await (await fh.getFile()).text();

    expect(text).toBe("content");
  });
});
