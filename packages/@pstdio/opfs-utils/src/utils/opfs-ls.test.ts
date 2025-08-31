import { describe, expect, it, vi } from "vitest";
import { setupTestOPFS, writeFile } from "../__helpers__/test-opfs";
import { getOPFSRoot } from "../shared";
import { LsEntry, formatLong, formatMtime, formatSize, formatTree, ls } from "./opfs-ls";

describe("formatSize", () => {
  it("formats bytes with units", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1536)).toBe("1.5 KB");
  });
});

describe("formatMtime", () => {
  it("formats epoch time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const d = new Date(Date.now());
    const pad = (x: number) => (x < 10 ? "0" + x : "" + x);
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(formatMtime(Date.now())).toBe(expected);

    vi.useRealTimers();
  });
});

describe("formatLong and formatTree", () => {
  const entries: LsEntry[] = [
    { path: "dir", name: "dir", kind: "directory", depth: 1 },
    {
      path: "dir/file.txt",
      name: "file.txt",
      kind: "file",
      depth: 2,
      size: 1024,
      lastModified: 0,
    },
  ];

  it("produces ls-style output", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);

    const d = new Date(Date.now());
    const pad = (x: number) => (x < 10 ? "0" + x : "" + x);
    const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    const expected = ["d          -  -  dir", `-     1.0 KB  ${ts}  dir/file.txt`].join("\n");

    expect(formatLong(entries)).toBe(expected);

    vi.useRealTimers();
  });

  it("builds a tree representation", () => {
    expect(formatTree(entries)).toBe(["└── dir/", "    └── file.txt"].join("\n"));
  });
});

describe("ls over OPFS", () => {
  it("lists files via directory handles", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "dir/file.txt", "hi");
    await (root as any).getDirectoryHandle("empty", { create: true });

    const entries = await ls(root, { maxDepth: Infinity, stat: true });
    expect(entries.map((e) => e.path).sort()).toEqual(["dir", "dir/file.txt", "empty"]);
  });
});
