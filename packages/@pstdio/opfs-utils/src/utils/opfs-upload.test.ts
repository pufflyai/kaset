import { describe, expect, it } from "vitest";
import { setupTestOPFS } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../shared";
import { pickAndUploadFilesToDirectory, uploadFilesToDirectory } from "./opfs-upload";

async function readText(dir: FileSystemDirectoryHandle, path: string) {
  const parts = path.split("/");
  let cur = dir;

  for (let i = 0; i < parts.length - 1; i++) {
    cur = await cur.getDirectoryHandle(parts[i], { create: false });
  }

  const fh = await cur.getFileHandle(parts[parts.length - 1], { create: false });
  const f = await fh.getFile();
  return await f.text();
}

describe("uploadFilesToDirectory", () => {
  it("uploads with path options and overwrite modes", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();
    const destRoot = await (root as any).getDirectoryHandle("dst", { create: true });

    const fileA = new File(["hi"], "a.txt");
    await uploadFilesToDirectory(destRoot, [fileA]);
    expect(await readText(destRoot, "a.txt")).toBe("hi");

    const fileB = new File(["hi"], "b.txt");
    await uploadFilesToDirectory(destRoot, [fileB], { destSubdir: "inbox" });
    expect(await readText(destRoot, "inbox/b.txt")).toBe("hi");

    const fileC = new File(["hi"], "c.txt");
    await uploadFilesToDirectory(destRoot, [fileC], {
      pathMapper: (f) => `by-type/text/${f.name}`,
    });
    expect(await readText(destRoot, "by-type/text/c.txt")).toBe("hi");

    const big1 = new File(["1"], "d.txt");
    await uploadFilesToDirectory(destRoot, [big1]);

    const big2 = new File(["22"], "d.txt");
    await uploadFilesToDirectory(destRoot, [big2], { overwrite: "replace" });
    expect(await readText(destRoot, "d.txt")).toBe("22");

    const skip1 = new File(["orig"], "e.txt");
    await uploadFilesToDirectory(destRoot, [skip1]);
    const skip2 = new File(["new"], "e.txt");
    const rSkip = await uploadFilesToDirectory(destRoot, [skip2], { overwrite: "skip" });
    expect(await readText(destRoot, "e.txt")).toBe("orig");
    expect(rSkip.errors.length).toBe(1);

    const rn1 = new File(["x"], "f.txt");
    await uploadFilesToDirectory(destRoot, [rn1]);
    const rn2 = new File(["y"], "f.txt");
    await uploadFilesToDirectory(destRoot, [rn2], { overwrite: "rename" });
    expect(await readText(destRoot, "f.txt")).toBe("x");
    expect(await readText(destRoot, "f (1).txt")).toBe("y");
  });
});

describe("pickAndUploadFilesToDirectory", () => {
  it("throws without DOM", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();
    await expect(pickAndUploadFilesToDirectory(root, { accept: "*/*" })).rejects.toThrow();
  });
});
