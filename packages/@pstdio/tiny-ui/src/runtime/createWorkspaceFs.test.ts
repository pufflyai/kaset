import { beforeEach, describe, expect, it, vi } from "vitest";

const createScopedFs = vi.fn();

vi.mock("@pstdio/opfs-utils", async () => {
  const actual = await vi.importActual<typeof import("@pstdio/opfs-utils")>("@pstdio/opfs-utils");
  return {
    ...actual,
    createScopedFs,
  };
});

describe("createWorkspaceFs", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("normalizes roots and delegates readFile", async () => {
    const fsMock = { readFile: vi.fn().mockResolvedValue(new Uint8Array([1])) };
    createScopedFs.mockReturnValue(fsMock);

    const { createWorkspaceFs } = await import("./createWorkspaceFs");
    const workspaceFs = createWorkspaceFs("/workspace/");

    await workspaceFs.readFile("./docs/readme.md");
    expect(createScopedFs).toHaveBeenCalledWith("workspace");
    expect(fsMock.readFile).toHaveBeenCalledWith("docs/readme.md");
  });

  it("rejects empty paths", async () => {
    const fsMock = { readFile: vi.fn() };
    createScopedFs.mockReturnValue(fsMock);

    const { createWorkspaceFs } = await import("./createWorkspaceFs");
    const workspaceFs = createWorkspaceFs("workspace");

    await expect(workspaceFs.readFile("")).rejects.toThrow(/requires a relative file path/i);
  });
});
