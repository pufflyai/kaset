import { beforeEach, describe, expect, it, vi } from "vitest";

const createScopedFs = vi.fn();
const ls = vi.fn();

type ScopedFsMock = {
  [K in keyof import("@pstdio/opfs-utils").ScopedFs]: ReturnType<
    typeof vi.fn<import("@pstdio/opfs-utils").ScopedFs[K]>
  >;
};

vi.mock("@pstdio/opfs-utils", async () => {
  const actual = await vi.importActual<typeof import("@pstdio/opfs-utils")>("@pstdio/opfs-utils");
  return {
    ...actual,
    createScopedFs,
    ls,
  };
});

async function setup(options: Partial<import("./createIframeOps").CreateIframeOpsOptions> = {}) {
  const pluginFs: ScopedFsMock = {
    readFile: vi.fn<import("@pstdio/opfs-utils").ScopedFs["readFile"]>(),
    writeFile: vi.fn<import("@pstdio/opfs-utils").ScopedFs["writeFile"]>(),
    deleteFile: vi.fn<import("@pstdio/opfs-utils").ScopedFs["deleteFile"]>(),
    readdir: vi.fn<import("@pstdio/opfs-utils").ScopedFs["readdir"]>(),
    moveFile: vi.fn<import("@pstdio/opfs-utils").ScopedFs["moveFile"]>(),
    exists: vi.fn<import("@pstdio/opfs-utils").ScopedFs["exists"]>(),
    mkdirp: vi.fn<import("@pstdio/opfs-utils").ScopedFs["mkdirp"]>(),
    readJSON: vi.fn<import("@pstdio/opfs-utils").ScopedFs["readJSON"]>(),
    writeJSON: vi.fn<import("@pstdio/opfs-utils").ScopedFs["writeJSON"]>(),
  };

  createScopedFs.mockReturnValue(pluginFs as unknown as import("@pstdio/opfs-utils").ScopedFs);

  const { createIframeOps } = await import("./createIframeOps");
  const handler = createIframeOps({
    pluginsRoot: "/plugins",
    pluginId: "demo",
    notify: () => undefined,
    ...options,
  });

  return { handler, pluginFs };
}

describe("createIframeOps", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useRealTimers();
    ls.mockResolvedValue([]);
  });

  it("bridges scoped fs helpers", async () => {
    const { handler, pluginFs } = await setup();

    pluginFs.exists.mockResolvedValue(true);
    pluginFs.mkdirp.mockResolvedValue(undefined);
    pluginFs.moveFile.mockResolvedValue(undefined);
    pluginFs.readJSON.mockResolvedValue({ hello: "world" });
    pluginFs.writeJSON.mockResolvedValue(undefined);

    const exists = await handler({ method: "fs.exists", params: { path: "./notes.txt" } });
    expect(pluginFs.exists).toHaveBeenCalledWith("data/notes.txt");
    expect(exists).toBe(true);

    await handler({ method: "fs.mkdirp", params: { path: "nested/docs" } });
    expect(pluginFs.mkdirp).toHaveBeenCalledWith("data/nested/docs");

    await handler({ method: "fs.moveFile", params: { from: "notes.txt", to: "archive/notes.txt" } });
    expect(pluginFs.moveFile).toHaveBeenCalledWith("data/notes.txt", "data/archive/notes.txt");

    const json = await handler({ method: "fs.readJSON", params: { path: "config.json" } });
    expect(pluginFs.readJSON).toHaveBeenCalledWith("data/config.json");
    expect(json).toEqual({ hello: "world" });

    await handler({
      method: "fs.writeJSON",
      params: { path: "config.json", value: { a: 1 }, pretty: true },
    });
    expect(pluginFs.writeJSON).toHaveBeenCalledWith("data/config.json", { a: 1 }, true);
  });

  it("returns structured directory listings", async () => {
    ls.mockResolvedValue([
      { path: "doc.txt", name: "doc.txt", kind: "file", depth: 1, size: 12, lastModified: 100 },
      { path: "drafts", name: "drafts", kind: "directory", depth: 1 },
    ]);

    const { handler } = await setup();

    const entries = (await handler({
      method: "fs.ls",
      params: { dir: "notes", detailed: true },
    })) as import("./types").TinyFsEntry[];

    expect(ls).toHaveBeenCalledWith("plugins/demo/data/notes", {
      maxDepth: 1,
      stat: true,
      dirsFirst: true,
      sortBy: "name",
    });

    expect(entries).toEqual([
      { path: "notes/doc.txt", name: "doc.txt", kind: "file", depth: 1, size: 12, lastModified: 100 },
      { path: "notes/drafts", name: "drafts", kind: "directory", depth: 1 },
    ]);
  });

  it("creates directory snapshots with signatures", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    ls.mockResolvedValue([
      { path: "todo.md", name: "todo.md", kind: "file", depth: 1, size: 24, lastModified: 1704067200000 },
      { path: "ideas", name: "ideas", kind: "directory", depth: 1 },
    ]);

    const { handler } = await setup();

    const snapshot = (await handler({
      method: "fs.dirSnapshot",
      params: { dir: "" },
    })) as import("./types").TinyFsDirSnapshot;

    expect(ls).toHaveBeenCalledWith("plugins/demo/data", {
      maxDepth: 1,
      stat: true,
      dirsFirst: true,
      sortBy: "name",
    });

    expect(snapshot).toEqual({
      dir: "",
      entries: [
        {
          path: "todo.md",
          name: "todo.md",
          kind: "file",
          depth: 1,
          size: 24,
          lastModified: 1704067200000,
        },
        {
          path: "ideas",
          name: "ideas",
          kind: "directory",
          depth: 1,
        },
      ],
      signature: "ideas|directory||;todo.md|file|1704067200000|24",
      generatedAt: new Date("2024-01-01T00:00:00Z").getTime(),
    });

    vi.useRealTimers();
  });

  it("throws when directory snapshots are disabled", async () => {
    const { handler } = await setup({ enableDirSnapshots: false });

    await expect(handler({ method: "fs.dirSnapshot", params: { dir: "" } })).rejects.toThrow(
      /directory snapshots are disabled/i,
    );
  });

  it("disables metadata when not requested", async () => {
    ls.mockResolvedValue([{ path: "doc.txt", name: "doc.txt", kind: "file", depth: 1 }]);

    const { handler } = await setup();
    await handler({ method: "fs.ls", params: { dir: "docs" } });

    expect(ls).toHaveBeenCalledWith("plugins/demo/data/docs", {
      maxDepth: 1,
      stat: false,
      dirsFirst: true,
      sortBy: "name",
    });
  });
});
