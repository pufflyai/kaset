import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_patch } from "./opfs-patch";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  patch: vi.fn(),
}));

import { hasParentTraversal, joinUnderWorkspace, patch as applyPatchInOPFS } from "@pstdio/opfs-utils";

describe("opfs_patch", () => {
  const rootDir = "/workspace";
  const approvalGate = { check: vi.fn() };
  const runner = opfs_patch({ rootDir, approvalGate });

  const toolCallId = "patch-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_patch", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedApplyPatch = vi.mocked(applyPatchInOPFS);
  const mockedGateCheck = vi.mocked(approvalGate.check);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("rejects when cwd escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ diff: "--- a\n+++ b\n", cwd: "../escape" }, config)).rejects.toThrow(
      "Path escapes workspace: invalid cwd",
    );

    expect(hasParentTraversal).toHaveBeenCalledWith("../escape");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(applyPatchInOPFS).not.toHaveBeenCalled();
  });

  it("applies diff in workspace root by default", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace");
    mockedApplyPatch.mockResolvedValue({ success: true, output: "applied" });

    const diff = "--- a\n+++ b\n@@\n-foo\n+bar\n";
    const result = await runner({ diff }, config);

    expect(mockedGateCheck).toHaveBeenCalledWith("opfs_patch", rootDir, {
      summary: diff.slice(0, 200),
    });

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "");
    expect(applyPatchInOPFS).toHaveBeenCalledWith({ workDir: "/workspace", diffContent: diff });

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({ success: true, output: "applied" });
  });

  it("truncates diff summary when requesting approval", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/feature");
    mockedApplyPatch.mockResolvedValue({ success: true, output: "applied" });

    const longDiff = "x".repeat(250);

    await runner({ diff: longDiff, cwd: "feature" }, config);

    expect(mockedGateCheck).toHaveBeenCalledWith("opfs_patch", rootDir, {
      summary: longDiff.slice(0, 200),
    });
    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "feature");
  });
});
