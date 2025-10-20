import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import type { LsEntry } from "@pstdio/opfs-utils";
import { opfs_ls } from "./opfs-ls";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  ls: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, ls } from "@pstdio/opfs-utils";

describe("opfs_ls", () => {
  const rootDir = "/root";
  const runner = opfs_ls({ rootDir, approvalGate: null });

  const toolCallId = "abc123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_ls", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedLs = vi.mocked(ls);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws if path escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ path: "../oops" }, config)).rejects.toThrow("Path escapes workspace: invalid path");

    expect(hasParentTraversal).toHaveBeenCalledWith("../oops");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(ls).not.toHaveBeenCalled();
  });

  it("applies defaults and calls ls with correct options", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/root/mydir");
    const entries: LsEntry[] = [{ path: "/root/mydir/a", name: "a", kind: "file", depth: 1 }];
    mockedLs.mockResolvedValue(entries);

    const res = await runner({ path: "mydir" }, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith("/root", "mydir");
    expect(ls).toHaveBeenCalledWith("/root/mydir", {
      maxDepth: 1,
      include: undefined,
      exclude: undefined,
      showHidden: false,
      stat: false,
      sortBy: "path",
      sortOrder: "asc",
      dirsFirst: true,
    });

    expect(res.messages).toHaveLength(1);

    const message = res.messages[0];
    expect(message.role).toBe("tool");
    expect(message.tool_call_id).toBe(toolCallId);

    const parsedContent = JSON.parse(message.content);
    expect(parsedContent.entries).toEqual(entries);
  });

  it("passes include, exclude, stat, showHidden, and maxDepth through", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/root");
    mockedLs.mockResolvedValue([]);

    const params = {
      include: ["**/*.json"],
      exclude: ["**/node_modules/**"],
      showHidden: true,
      stat: true,
      maxDepth: 5,
    };

    await runner(params, config);

    expect(ls).toHaveBeenCalledWith("/root", {
      ...params,
      sortBy: "path",
      sortOrder: "asc",
      dirsFirst: true,
    });
  });

  it("handles undefined path by defaulting to workspace root", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/root");
    mockedLs.mockResolvedValue([]);

    await runner({}, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith("/root", "");
  });

  it("uses empty tool_call_id when config.toolCall is missing", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/root");
    mockedLs.mockResolvedValue([]);

    const result = await runner({}, {} as ToolConfig);

    expect(result.messages[0].tool_call_id).toBe("");
  });
});
