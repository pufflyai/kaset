import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_shell } from "./opfs-shell";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  runOpfsCommandLine: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, runOpfsCommandLine } from "@pstdio/opfs-utils";

describe("opfs_shell", () => {
  const rootDir = "/workspace";
  const runner = opfs_shell({ rootDir, approvalGate: null });

  const toolCallId = "shell-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_shell", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedRunCommand = vi.mocked(runOpfsCommandLine);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when cwd escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ command: "ls", cwd: "../" }, config)).rejects.toThrow("Path escapes workspace: invalid cwd");

    expect(hasParentTraversal).toHaveBeenCalledWith("../");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(runOpfsCommandLine).not.toHaveBeenCalled();
  });

  it("runs command in workspace and reports result", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/src");
    mockedRunCommand.mockResolvedValue({ code: 0, stdout: "done", stderr: "" });

    const result = await runner({ command: "ls -la", cwd: "src" }, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "src");
    expect(runOpfsCommandLine).toHaveBeenCalledWith("ls -la", { cwd: "/workspace/src" });

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({
      success: true,
      code: 0,
      stdout: "done",
      stderr: "",
      cwd: "/workspace/src",
    });
  });

  it("marks success false when command fails", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace");
    mockedRunCommand.mockResolvedValue({ code: 1, stdout: "", stderr: "error" });

    const result = await runner({ command: "false" }, config);

    const payload = JSON.parse(result.messages[0].content);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe(1);
  });
});
