import { describe, expect, it } from "vitest";
import { setupTestOPFS } from "../__helpers__/test-opfs";
import { readTextFileOptional } from "../shared";
import { pickAndUploadFilesToDirectory, uploadFilesToDirectory } from "./opfs-upload";

async function readText(path: string) {
  const text = await readTextFileOptional(path);
  if (text == null) throw new Error("File missing: " + path);
  return text;
}

describe("uploadFilesToDirectory", () => {
  it("uploads with path options and overwrite modes", async () => {
    setupTestOPFS();
    const destPath = "dst";

    const fileA = new File(["hi"], "a.txt");
    await uploadFilesToDirectory(destPath, [fileA]);
    expect(await readText("dst/a.txt")).toBe("hi");

    const fileB = new File(["hi"], "b.txt");
    await uploadFilesToDirectory(destPath, [fileB], { destSubdir: "inbox" });
    expect(await readText("dst/inbox/b.txt")).toBe("hi");

    const fileC = new File(["hi"], "c.txt");
    await uploadFilesToDirectory(destPath, [fileC], {
      pathMapper: (f) => `by-type/text/${f.name}`,
    });
    expect(await readText("dst/by-type/text/c.txt")).toBe("hi");

    const big1 = new File(["1"], "d.txt");
    await uploadFilesToDirectory(destPath, [big1]);

    const big2 = new File(["22"], "d.txt");
    await uploadFilesToDirectory(destPath, [big2], { overwrite: "replace" });
    expect(await readText("dst/d.txt")).toBe("22");

    const skip1 = new File(["orig"], "e.txt");
    await uploadFilesToDirectory(destPath, [skip1]);
    const skip2 = new File(["new"], "e.txt");
    const rSkip = await uploadFilesToDirectory(destPath, [skip2], { overwrite: "skip" });
    expect(await readText("dst/e.txt")).toBe("orig");
    expect(rSkip.errors.length).toBe(1);

    const rn1 = new File(["x"], "f.txt");
    await uploadFilesToDirectory(destPath, [rn1]);
    const rn2 = new File(["y"], "f.txt");
    await uploadFilesToDirectory(destPath, [rn2], { overwrite: "rename" });
    expect(await readText("dst/f.txt")).toBe("x");
    expect(await readText("dst/f (1).txt")).toBe("y");
  });
});

describe("pickAndUploadFilesToDirectory", () => {
  it("throws without DOM", async () => {
    setupTestOPFS();
    await expect(pickAndUploadFilesToDirectory("dst", { accept: "*/*" })).rejects.toThrow();
  });
});
