import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks for @pstdio/opfs-utils used by the hooks
let mockContent: Record<string, string> = {};
let activeWatchCallback: ((changes: Array<{ path: string[] }>) => void) | null = null;

vi.mock("@pstdio/opfs-utils", () => {
  return {
    getDirectoryHandle: vi.fn(async () => ({}) as any),
    readFile: vi.fn(async (path: string) => mockContent[path] ?? ""),
    ls: vi.fn(async () => [] as any),
    watchDirectory: vi.fn(async (_dir: any, cb: (changes: any[]) => void) => {
      activeWatchCallback = cb;
      return () => {
        activeWatchCallback = null;
      };
    }),
  };
});

import { useFileContent, useFolder } from "./index";

afterEach(() => {
  mockContent = {};
  activeWatchCallback = null;
  vi.clearAllMocks();
});

function FileViewer({ path }: { path?: string }) {
  const { content } = useFileContent(path);
  return <div data-testid="content">{content}</div>;
}

function FolderViewer({ path = "" }: { path?: string }) {
  const { rootNode } = useFolder(path);
  return <div data-testid="root">{rootNode ? rootNode.name : "none"}</div>;
}

describe("useFileContent", () => {
  it("loads initial content and updates on change", async () => {
    const filePath = "dir/file.txt";
    mockContent[filePath] = "hello";

    render(<FileViewer path={filePath} />);

    await waitFor(() => expect(screen.getByTestId("content").textContent).toBe("hello"));

    // Simulate a file change event from the directory watcher
    mockContent[filePath] = "world";
    activeWatchCallback?.([{ path: ["file.txt"] }]);

    await waitFor(() => expect(screen.getByTestId("content").textContent).toBe("world"));
  });
});

describe("useFolder", () => {
  it("builds a tree and refreshes on change", async () => {
    const utils = await import("@pstdio/opfs-utils");
    const lsMock = utils.ls as unknown as ReturnType<typeof vi.fn>;

    // Initial listing: empty
    lsMock.mockResolvedValueOnce([]);

    render(<FolderViewer path="dir" />);

    await waitFor(() => expect(screen.getByTestId("root").textContent).toBe("dir"));

    // Next listing: one file appears
    lsMock.mockResolvedValueOnce([
      { path: "", name: "dir", kind: "directory", depth: 1 },
      { path: "a.txt", name: "a.txt", kind: "file", depth: 1 },
    ] as any);

    activeWatchCallback?.([{ path: ["a.txt"] }]);

    // Tree rebuild triggers; still rooted at 'dir'
    await waitFor(() => expect(screen.getByTestId("root").textContent).toBe("dir"));
  });
});
