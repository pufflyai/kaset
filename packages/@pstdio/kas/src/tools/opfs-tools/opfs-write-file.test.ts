import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_write_file } from "./opfs-write-file";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  writeFile: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, writeFile as writeFileAtRoot } from "@pstdio/opfs-utils";

describe("opfs_write_file", () => {
  const rootDir = "/workspace";
  const approvalGate = { check: vi.fn() };
  const runner = opfs_write_file({ rootDir, approvalGate });

  const toolCallId = "write-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_write_file", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedWriteFile = vi.mocked(writeFileAtRoot);
  const mockedGateCheck = vi.mocked(approvalGate.check);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when file path escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ file: "../hack", content: "alert(1);" }, config)).rejects.toThrow(
      "Path escapes workspace: invalid file",
    );

    expect(hasParentTraversal).toHaveBeenCalledWith("../hack");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(writeFileAtRoot).not.toHaveBeenCalled();
  });

  it("writes file after approval and returns success payload", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/src/index.ts");
    mockedWriteFile.mockResolvedValue(undefined);

    const result = await runner({ file: "src/index.ts", content: "console.log('hi');" }, config);

    expect(mockedGateCheck).toHaveBeenCalledWith("opfs_write_file", rootDir, { file: "src/index.ts" });
    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "src/index.ts");
    expect(writeFileAtRoot).toHaveBeenCalledWith("/workspace/src/index.ts", "console.log('hi');");

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({
      ok: true,
      file: "/workspace/src/index.ts",
    });
  });
});
