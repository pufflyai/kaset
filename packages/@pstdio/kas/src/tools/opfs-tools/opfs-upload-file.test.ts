import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_upload_files } from "./opfs-upload-file";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  uploadFilesToDirectory: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, uploadFilesToDirectory } from "@pstdio/opfs-utils";

describe("opfs_upload_files", () => {
  const rootDir = "/workspace";
  const approvalGate = { check: vi.fn() };
  const runner = opfs_upload_files({ rootDir, approvalGate });

  const toolCallId = "upload-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_upload_files", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedUpload = vi.mocked(uploadFilesToDirectory);
  const mockedGateCheck = vi.mocked(approvalGate.check);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when destination subdirectory escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    const files = [{ name: "a.txt" }] as unknown as File[];

    await expect(runner({ destSubdir: "../bad", files }, config)).rejects.toThrow(
      "Path escapes workspace: invalid destSubdir",
    );

    expect(hasParentTraversal).toHaveBeenCalledWith("../bad");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(uploadFilesToDirectory).not.toHaveBeenCalled();
  });

  it("uploads files to root by default and reports payload", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace");
    mockedUpload.mockResolvedValue({ success: true, uploadedFiles: ["a.txt"], errors: [] });

    const files = [{ name: "a.txt" }] as unknown as File[];
    const result = await runner({ files }, config);

    expect(mockedGateCheck).toHaveBeenCalledWith("opfs_upload_files", rootDir, {
      destSubdir: undefined,
      count: 1,
    });

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "");
    expect(uploadFilesToDirectory).toHaveBeenCalledWith("/workspace", files, {
      overwrite: undefined,
    });

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({
      success: true,
      uploadedFiles: ["a.txt"],
      errors: [],
    });
  });

  it("passes overwrite option and destination to uploader", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/assets");
    mockedUpload.mockResolvedValue({ success: true, uploadedFiles: [], errors: [] });

    const files = [] as unknown as File[];

    await runner({ destSubdir: "assets", overwrite: "rename", files }, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "assets");
    expect(uploadFilesToDirectory).toHaveBeenCalledWith("/workspace/assets", files, {
      overwrite: "rename",
    });
  });
});
