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
  it("shows <empty> for no entries", () => {
    expect(formatTree([])).toBe("<empty>");
  });

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

describe("formatTree - complex inputs", () => {
  const complexEntriesWithoutParents: LsEntry[] = [
    { path: "nested/a", name: "a", kind: "directory", depth: 2 },
    { path: "nested/a/b", name: "b", kind: "directory", depth: 3 },
    { path: "nested/a/b/c", name: "c", kind: "directory", depth: 4 },
    {
      path: ".hidden/secret.txt",
      name: "secret.txt",
      kind: "file",
      depth: 2,
      size: 26,
      lastModified: 1756636687767,
      type: "text/plain",
    },
    {
      path: "assets/logo.svg",
      name: "logo.svg",
      kind: "file",
      depth: 2,
      size: 274,
      lastModified: 1756636687705,
      type: "image/svg+xml",
    },
    {
      path: "docs/notes.txt",
      name: "notes.txt",
      kind: "file",
      depth: 2,
      size: 50,
      lastModified: 1756636687445,
      type: "text/plain",
    },
    {
      path: "docs/PROJECT_README.md",
      name: "PROJECT_README.md",
      kind: "file",
      depth: 2,
      size: 6450,
      lastModified: 1756636687521,
      type: "text/markdown",
    },
    {
      path: "nested/a/b/c/deep.txt",
      name: "deep.txt",
      kind: "file",
      depth: 5,
      size: 30,
      lastModified: 1756636687831,
      type: "text/plain",
    },
    {
      path: "src/index.ts",
      name: "index.ts",
      kind: "file",
      depth: 2,
      size: 115,
      lastModified: 1756636687584,
      type: "video/vnd.dlna.mpeg-tts",
    },
    {
      path: "src/util.ts",
      name: "util.ts",
      kind: "file",
      depth: 2,
      size: 94,
      lastModified: 1756636687647,
      type: "video/vnd.dlna.mpeg-tts",
    },
  ];

  it("renders full tree even when root parents are missing", () => {
    const expected = [
      "├── .hidden/",
      "│   └── secret.txt",
      "├── assets/",
      "│   └── logo.svg",
      "├── docs/",
      "│   ├── notes.txt",
      "│   └── PROJECT_README.md",
      "├── nested/",
      "│   └── a/",
      "│       └── b/",
      "│           └── c/",
      "│               └── deep.txt",
      "└── src/",
      "    ├── index.ts",
      "    └── util.ts",
    ].join("\n");

    expect(formatTree(complexEntriesWithoutParents)).toBe(expected);
  });

  // Legacy behavior tested emptiness; now we synthesize parents, so it renders.

  it("renders correctly once top-level parent directories are included", () => {
    const withParents: LsEntry[] = [
      { path: ".hidden", name: ".hidden", kind: "directory", depth: 1 },
      { path: "assets", name: "assets", kind: "directory", depth: 1 },
      { path: "docs", name: "docs", kind: "directory", depth: 1 },
      { path: "nested", name: "nested", kind: "directory", depth: 1 },
      { path: "src", name: "src", kind: "directory", depth: 1 },
      ...complexEntriesWithoutParents,
    ];

    const expected = [
      "├── .hidden/",
      "│   └── secret.txt",
      "├── assets/",
      "│   └── logo.svg",
      "├── docs/",
      "│   ├── notes.txt",
      "│   └── PROJECT_README.md",
      "├── nested/",
      "│   └── a/",
      "│       └── b/",
      "│           └── c/",
      "│               └── deep.txt",
      "└── src/",
      "    ├── index.ts",
      "    └── util.ts",
    ].join("\n");

    expect(formatTree(withParents)).toBe(expected);
  });
});

describe("ls over OPFS", () => {
  it("lists files via adapter path", async () => {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "dir/file.txt", "hi");
    await (root as any).getDirectoryHandle("empty", { create: true });

    const entries = await ls(".", { maxDepth: Infinity, stat: true });
    expect(entries.map((e) => e.path).sort()).toEqual(["dir", "dir/file.txt", "empty"]);
  });
});

describe("ls over OPFS + formatTree interplay", () => {
  async function seedComplexTree() {
    setupTestOPFS();
    const root = await getOPFSRoot();

    await writeFile(root, "nested/a/b/c/deep.txt", "deep");
    await writeFile(root, ".hidden/secret.txt", "secret");
    await writeFile(root, "assets/logo.svg", "<svg />");
    await writeFile(root, "docs/notes.txt", "notes");
    await writeFile(root, "docs/PROJECT_README.md", "readme");
    await writeFile(root, "src/index.ts", "export{};");
    await writeFile(root, "src/util.ts", "export{};");

    return root;
  }

  it("formatTree renders tree even when ls returns files only (parents synthesized)", async () => {
    await seedComplexTree();

    const filesOnly = await ls(".", { maxDepth: Infinity, kinds: ["file"], stat: true, showHidden: true });

    const expected = [
      "├── .hidden/",
      "│   └── secret.txt",
      "├── assets/",
      "│   └── logo.svg",
      "├── docs/",
      "│   ├── notes.txt",
      "│   └── PROJECT_README.md",
      "├── nested/",
      "│   └── a/",
      "│       └── b/",
      "│           └── c/",
      "│               └── deep.txt",
      "└── src/",
      "    ├── index.ts",
      "    └── util.ts",
    ].join("\n");

    expect(formatTree(filesOnly)).toBe(expected);
  });

  it("formatTree renders a full tree when directories are included", async () => {
    await seedComplexTree();

    const all = await ls(".", { maxDepth: Infinity, stat: true, showHidden: true });

    const expected = [
      "├── .hidden/",
      "│   └── secret.txt",
      "├── assets/",
      "│   └── logo.svg",
      "├── docs/",
      "│   ├── notes.txt",
      "│   └── PROJECT_README.md",
      "├── nested/",
      "│   └── a/",
      "│       └── b/",
      "│           └── c/",
      "│               └── deep.txt",
      "└── src/",
      "    ├── index.ts",
      "    └── util.ts",
    ].join("\n");

    expect(formatTree(all)).toBe(expected);
  });

  it("formatTree works when include is ['**/*'] (parents synthesized)", async () => {
    await seedComplexTree();

    const filtered = await ls(".", {
      maxDepth: Infinity,
      include: ["**/*"],
      showHidden: true,
      // default kinds includes directories + files, but top-level dirs are filtered out by '**/*'
    });

    // Sanity: we did get entries; parents are synthesized by formatTree
    expect(filtered.length).toBeGreaterThan(0);

    const expected = [
      "├── .hidden/",
      "│   └── secret.txt",
      "├── assets/",
      "│   └── logo.svg",
      "├── docs/",
      "│   ├── notes.txt",
      "│   └── PROJECT_README.md",
      "├── nested/",
      "│   └── a/",
      "│       └── b/",
      "│           └── c/",
      "│               └── deep.txt",
      "└── src/",
      "    ├── index.ts",
      "    └── util.ts",
    ].join("\n");

    expect(formatTree(filtered)).toBe(expected);
  });

  it("formatTree works when include is ['**'] (includes parents)", async () => {
    await seedComplexTree();

    const allWithParents = await ls(".", {
      maxDepth: Infinity,
      include: ["**"],
      showHidden: true,
    });

    expect(formatTree(allWithParents)).toContain("src/");
    expect(formatTree(allWithParents)).toContain("docs/");
    expect(formatTree(allWithParents)).toContain("nested/");
    expect(formatTree(allWithParents)).toContain(".hidden/");
  });
});
