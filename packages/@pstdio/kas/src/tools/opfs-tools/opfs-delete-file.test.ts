import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_delete_file } from "./opfs-delete-file";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  deleteFile: vi.fn(),
}));

import { deleteFile as deleteFileAtRoot, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";

describe("opfs_delete_file", () => {
  const rootDir = "/workspace";
  const approvalGate = { check: vi.fn() };
  const runner = opfs_delete_file({ rootDir, approvalGate });

  const toolCallId = "delete-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_delete_file", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedDeleteFile = vi.mocked(deleteFileAtRoot);
  const mockedGateCheck = vi.mocked(approvalGate.check);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when file path escapes the workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ file: "../etc/passwd" }, config)).rejects.toThrow("Path escapes workspace: invalid file");

    expect(hasParentTraversal).toHaveBeenCalledWith("../etc/passwd");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(deleteFileAtRoot).not.toHaveBeenCalled();
    expect(mockedGateCheck).not.toHaveBeenCalled();
  });

  it("requires an approval gate", async () => {
    const noGateRunner = opfs_delete_file({ rootDir, approvalGate: null });
    mockedHasParentTraversal.mockReturnValue(false);

    await expect(noGateRunner({ file: "notes.txt" }, config)).rejects.toThrow(
      "Approval gate not configured for opfs_delete_file",
    );

    expect(mockedGateCheck).not.toHaveBeenCalled();
  });

  it("checks approval and deletes the file", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/notes.txt");
    mockedDeleteFile.mockResolvedValue(undefined);

    const result = await runner({ file: "notes.txt" }, config);

    expect(mockedGateCheck).toHaveBeenCalledWith("opfs_delete_file", rootDir, { file: "notes.txt" });
    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "notes.txt");
    expect(deleteFileAtRoot).toHaveBeenCalledWith("/workspace/notes.txt");

    const message = result.messages[0];
    expect(message.role).toBe("tool");
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({ ok: true, file: "/workspace/notes.txt" });
  });

  it("falls back to empty tool_call_id when missing in config", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/notes.txt");
    mockedDeleteFile.mockResolvedValue(undefined);

    const result = await runner({ file: "notes.txt" }, {} as ToolConfig);

    expect(result.messages[0].tool_call_id).toBe("");
  });
});
