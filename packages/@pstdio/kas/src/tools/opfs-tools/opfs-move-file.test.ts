import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_move_file } from "./opfs-move-file";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  moveFile: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, moveFile as moveFileAtRoot } from "@pstdio/opfs-utils";

describe("opfs_move_file", () => {
  const rootDir = "/workspace";
  const approvalGate = { check: vi.fn() };
  const runner = opfs_move_file({ rootDir, approvalGate });

  const toolCallId = "move-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_move_file", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedMoveFile = vi.mocked(moveFileAtRoot);
  const mockedGateCheck = vi.mocked(approvalGate.check);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when source path escapes workspace", async () => {
    mockedHasParentTraversal.mockImplementation((path) => path === "../from");

    await expect(runner({ from: "../from", to: "dest.txt" }, config)).rejects.toThrow(
      "Path escapes workspace: invalid from",
    );

    expect(hasParentTraversal).toHaveBeenCalledWith("../from");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(moveFileAtRoot).not.toHaveBeenCalled();
  });

  it("rejects when destination path escapes workspace", async () => {
    mockedHasParentTraversal.mockImplementation((path) => path === "../to");

    await expect(runner({ from: "src.txt", to: "../to" }, config)).rejects.toThrow(
      "Path escapes workspace: invalid to",
    );

    expect(hasParentTraversal).toHaveBeenCalledWith("src.txt");
    expect(hasParentTraversal).toHaveBeenCalledWith("../to");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(moveFileAtRoot).not.toHaveBeenCalled();
  });

  it("checks approval, moves the file, and returns tool message", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValueOnce("/workspace/src.txt").mockReturnValueOnce("/workspace/dest.txt");
    mockedMoveFile.mockResolvedValue(undefined);

    const result = await runner({ from: "src.txt", to: "dest.txt" }, config);

    expect(mockedGateCheck).toHaveBeenCalledWith("opfs_move_file", rootDir, {
      from: "src.txt",
      to: "dest.txt",
    });

    expect(joinUnderWorkspace).toHaveBeenNthCalledWith(1, rootDir, "src.txt");
    expect(joinUnderWorkspace).toHaveBeenNthCalledWith(2, rootDir, "dest.txt");
    expect(moveFileAtRoot).toHaveBeenCalledWith("/workspace/src.txt", "/workspace/dest.txt");

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({
      ok: true,
      from: "/workspace/src.txt",
      to: "/workspace/dest.txt",
    });
  });
});
