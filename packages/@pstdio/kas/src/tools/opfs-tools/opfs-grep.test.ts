import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolConfig } from "@pstdio/tiny-ai-tasks";
import { opfs_grep } from "./opfs-grep";

vi.mock("@pstdio/opfs-utils", () => ({
  hasParentTraversal: vi.fn(),
  joinUnderWorkspace: vi.fn(),
  grep: vi.fn(),
}));

import { grep, hasParentTraversal, joinUnderWorkspace } from "@pstdio/opfs-utils";

describe("opfs_grep", () => {
  const rootDir = "/workspace";
  const runner = opfs_grep({ rootDir, approvalGate: null });

  const toolCallId = "grep-123";
  const config: ToolConfig = {
    toolCall: { id: toolCallId, function: { name: "opfs_grep", arguments: "{}" } },
  };

  const mockedHasParentTraversal = vi.mocked(hasParentTraversal);
  const mockedJoinUnderWorkspace = vi.mocked(joinUnderWorkspace);
  const mockedGrep = vi.mocked(grep);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("throws when path escapes workspace", async () => {
    mockedHasParentTraversal.mockReturnValue(true);

    await expect(runner({ path: "../outside", pattern: "TODO" }, config)).rejects.toThrow(
      "Path escapes workspace: invalid path",
    );

    expect(hasParentTraversal).toHaveBeenCalledWith("../outside");
    expect(joinUnderWorkspace).not.toHaveBeenCalled();
    expect(grep).not.toHaveBeenCalled();
  });

  it("defaults path to root and uses default max file size", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace");
    mockedGrep.mockResolvedValue([{ file: "a.ts", matches: [] } as any]);

    const result = await runner({ pattern: "TODO" }, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "");
    expect(grep).toHaveBeenCalledWith("/workspace", {
      pattern: "TODO",
      flags: undefined,
      include: undefined,
      exclude: undefined,
      maxFileSize: 20 * 1024 * 1024,
    });

    const message = result.messages[0];
    expect(message.tool_call_id).toBe(toolCallId);
    expect(JSON.parse(message.content)).toEqual({
      count: 1,
      matches: [{ file: "a.ts", matches: [] }],
    });
  });

  it("forwards filtering options and maxFileSizeBytes", async () => {
    mockedHasParentTraversal.mockReturnValue(false);
    mockedJoinUnderWorkspace.mockReturnValue("/workspace/src");
    mockedGrep.mockResolvedValue([]);

    const params = {
      path: "src",
      pattern: "useState",
      flags: "gi",
      include: ["**/*.tsx"],
      exclude: ["**/*.test.tsx"],
      maxFileSizeBytes: 1024,
    };

    await runner(params, config);

    expect(joinUnderWorkspace).toHaveBeenCalledWith(rootDir, "src");
    expect(grep).toHaveBeenCalledWith("/workspace/src", {
      pattern: "useState",
      flags: "gi",
      include: ["**/*.tsx"],
      exclude: ["**/*.test.tsx"],
      maxFileSize: 1024,
    });
  });
});
