import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { setupTestOPFS, writeFile as writeTestFile } from "@pstdio/opfs-utils/src/__helpers__/test-opfs";

import { useFileContent, useFolder } from "./index";

function renderHook<T>(hook: () => T) {
  let result: T;

  function Test() {
    result = hook();
    return null;
  }

  const el = document.createElement("div");
  const root = createRoot(el);
  root.render(<Test />);

  return { result: () => result };
}

async function waitFor(fn: () => void, timeout = 1000) {
  const start = Date.now();

  while (true) {
    try {
      fn();
      return;
    } catch (err) {
      if (Date.now() - start > timeout) throw err;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

describe("useFileContent", () => {
  it("reads file content from OPFS", async () => {
    const root = setupTestOPFS();
    await writeTestFile(root, "a.txt", "hello world");

    const hook = renderHook(() => useFileContent("a.txt"));

    await waitFor(() => {
      expect(hook.result().content).toBe("hello world");
    });
  });
});

describe("useFolder", () => {
  it("builds a tree of files", async () => {
    const root = setupTestOPFS();
    await writeTestFile(root, "top.txt", "t");
    await writeTestFile(root, "dir/nested.txt", "n");

    const hook = renderHook(() => useFolder());

    await waitFor(() => {
      expect(hook.result().rootNode).not.toBeNull();
    });

    const node = hook.result().rootNode!;
    const names = node.children?.map((c) => c.name) ?? [];
    expect(names).toContain("top.txt");
    expect(names).toContain("dir");

    const dirNode = node.children?.find((c) => c.name === "dir");
    const childNames = dirNode?.children?.map((c) => c.name) ?? [];
    expect(childNames).toContain("nested.txt");
  });
});
