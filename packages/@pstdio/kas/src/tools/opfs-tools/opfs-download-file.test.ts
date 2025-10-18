import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_download_file } from "./opfs-download-file";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  downloadFile: vi.fn(),
}));

import { downloadFile as downloadFileAtRoot, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";

describe("opfs_download_file", () => {
  const rootDir = "/workspace";
  const runner = opfs_download_file({ rootDir, approvalGate: null });

  const toolCallId = "download-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_download_file", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedDownloadFile = vi.mocked(downloadFileAtRoot);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when file path escapes the workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ file: "../secret" }, config)).rejects.toThrow("Path escapes workspace: invalid file");

    expect(hasParentTraversal).toHaveBeenCalledWith("../secret");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(downloadFileAtRoot).not.toHaveBeenCalled();
  });

  it("downloads file and returns tool response", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/notes.txt");
    mockedDownloadFile.mockResolvedValue(undefined);

    const result = await runner({ file: "notes.txt" }, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "notes.txt");
    expect(downloadFileAtRoot).toHaveBeenCalledWith("/workspace/notes.txt");

    const message = result.messages[0];
    expect(message.role).toBe("tool");
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({ ok: true, file: "/workspace/notes.txt" });
  });
});
