import { describe, expect, it } from "vitest";
import { setupTestOPFS } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../__helpers__/test-opfs";
import { getFs } from "../adapter/fs";
import { deleteDirectoryContents, deleteFile, readFile, writeFile } from "./opfs-crud";

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

  it("sanitizes ANSI sequences in paths", async () => {
    setupTestOPFS();

    const red = "\u001b[31m";
    const reset = "\u001b[0m";
    const pathWithAnsi = `${red}dir${reset}/${red}file${reset}.txt`;

    await writeFile(pathWithAnsi, "ansi-ok");

    // Reading with a clean path should succeed
    await expect(readFile("dir/file.txt")).resolves.toBe("ansi-ok");

    // The underlying in-memory FS should only contain sanitized names
    const root = await getOPFSRoot();
    const dir = await (root as any).getDirectoryHandle("dir");
    const fh = await dir.getFileHandle("file.txt");
    const text = await (await fh.getFile()).text();
    expect(text).toBe("ansi-ok");
  });

  it("deleteDirectoryContents removes files and subdirectories", async () => {
    setupTestOPFS();

    await writeFile("sandbox/a/b.txt", "1");
    await writeFile("sandbox/a/c/d.txt", "2");
    await writeFile("sandbox/.hidden/e.txt", "3");

    await deleteDirectoryContents("sandbox");

    await expect(readFile("sandbox/a/b.txt")).rejects.toMatchObject({ name: "NotFoundError" });
    await expect(readFile("sandbox/.hidden/e.txt")).rejects.toMatchObject({ name: "NotFoundError" });

    const fs = await getFs();
    try {
      const entries = await fs.promises.readdir("/sandbox");
      expect(entries).toEqual([]);
    } catch (error: any) {
      const code = error?.code;
      const name = error?.name;
      expect(["ENOENT", "NotFoundError", "NotFound", 1]).toContain(code ?? name);
    }
  });
});
