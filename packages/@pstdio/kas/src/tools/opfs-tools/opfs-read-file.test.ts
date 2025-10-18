import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_read_file } from "./opfs-read-file";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  processSingleFileContent: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, processSingleFileContent } from "@pstdio/opfs-utils";

describe("opfs_read_file", () => {
  const rootDir = "/workspace";
  const runner = opfs_read_file({ rootDir, approvalGate: null });

  const toolCallId = "read-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_read_file", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedProcessSingleFileContent = vi.mocked(processSingleFileContent);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when file path escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ file: "../secret" }, config)).rejects.toThrow("Path escapes workspace: invalid file");

    expect(hasParentTraversal).toHaveBeenCalledWith("../secret");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(processSingleFileContent).not.toHaveBeenCalled();
  });

  it("reads file content with optional offset and limit", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/src/index.ts");
    mockedProcessSingleFileContent.mockResolvedValue({
      type: "text",
      content: "console.log('hello');",
    } as any);

    const params = { file: "src/index.ts", offset: 10, limit: 20 };
    const result = await runner(params, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "src/index.ts");
    expect(processSingleFileContent).toHaveBeenCalledWith("/workspace/src/index.ts", rootDir, undefined, 10, 20);

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({
      type: "text",
      content: "console.log('hello');",
      file: "/workspace/src/index.ts",
    });
  });
});
