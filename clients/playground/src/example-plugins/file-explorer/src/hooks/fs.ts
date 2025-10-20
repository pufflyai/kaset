import { useEffect, useMemo, useState } from "react";

export interface FsNode {
  id: string;
  name: string;
  children?: FsNode[];
}

type OpfsDirectoryHandle = FileSystemDirectoryHandle & {
  entries?: () => AsyncIterableIterator<[string, FileSystemHandle]>;
};

type OpfsFileHandle = FileSystemFileHandle;

type OpfsHandle = OpfsDirectoryHandle | OpfsFileHandle;

type StorageManagerWithDirectory = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

const normalizePath = (path: string | null | undefined) => {
  if (!path) return "";
  return path
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join("/");
};

const getRootLabel = (normalizedRoot: string) => {
  if (!normalizedRoot) return "/";
  const parts = normalizedRoot.split("/");
  return parts[parts.length - 1] || "/";
};

const toAbsolutePath = (rootId: string, relative: string) => {
  if (!relative) return rootId;
  if (!rootId || rootId === "/") return relative;
  return `${rootId}/${relative}`;
};

const createRootNode = (normalizedRoot: string): FsNode => {
  const rootId = normalizedRoot || "/";
  return {
    id: rootId,
    name: getRootLabel(normalizedRoot),
    children: [],
  };
};

const ensureDirectory = (
  relative: string,
  context: {
    rootId: string;
    rootName: string;
    nodeMap: Map<string, FsNode>;
  },
) => {
  const existing = context.nodeMap.get(relative);
  if (existing) return existing;

  const name = relative ? (relative.split("/").pop() ?? context.rootName) : context.rootName;
  const absoluteId = toAbsolutePath(context.rootId, relative);

  const dirNode: FsNode = {
    id: absoluteId,
    name,
    children: [],
  };

  context.nodeMap.set(relative, dirNode);

  if (!relative) return dirNode;

  const parentRelative = relative.includes("/") ? relative.slice(0, relative.lastIndexOf("/")) : "";
  const parentNode = ensureDirectory(parentRelative, context);

  parentNode.children = parentNode.children ?? [];
  if (!parentNode.children.some((child) => child.id === dirNode.id)) {
    parentNode.children.push(dirNode);
  }

  return dirNode;
};

const sortTree = (node: FsNode) => {
  if (!Array.isArray(node.children)) return;

  node.children.sort((a, b) => {
    const aIsDir = Array.isArray(a.children);
    const bIsDir = Array.isArray(b.children);

    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  for (const child of node.children) {
    if (Array.isArray(child.children)) sortTree(child);
  }
};

const isAbortError = (error: unknown) => {
  if (!error) return false;
  return (error as { name?: string }).name === "AbortError";
};

const isAborted = (signal?: AbortSignal) => signal?.aborted ?? false;

const getStorageManager = (): StorageManagerWithDirectory | null => {
  if (typeof navigator === "undefined") return null;
  const storage = navigator.storage as StorageManagerWithDirectory | undefined;
  return storage ?? null;
};

const getOpfsRoot = async (signal?: AbortSignal): Promise<OpfsDirectoryHandle | null> => {
  const storage = getStorageManager();
  if (!storage || typeof storage.getDirectory !== "function") return null;
  if (isAborted(signal)) return null;

  try {
    const handle = await storage.getDirectory();
    if (isAborted(signal)) return null;
    return handle as OpfsDirectoryHandle;
  } catch (error) {
    if (!isAbortError(error)) console.warn("Failed to obtain OPFS root", error);
    return null;
  }
};

const getDirectoryHandleForPath = async (
  root: OpfsDirectoryHandle,
  segments: string[],
  signal?: AbortSignal,
): Promise<OpfsDirectoryHandle | null> => {
  let current: OpfsDirectoryHandle = root;

  for (const segment of segments) {
    if (isAborted(signal)) return null;
    try {
      const next = await current.getDirectoryHandle(segment);
      current = next as OpfsDirectoryHandle;
    } catch {
      return null;
    }
  }

  return current;
};

const buildTreeFromDirectory = async (
  rootHandle: OpfsDirectoryHandle,
  normalizedRoot: string,
  signal?: AbortSignal,
) => {
  const rootNode = createRootNode(normalizedRoot);
  const context = {
    rootId: rootNode.id,
    rootName: rootNode.name,
    nodeMap: new Map<string, FsNode>([["", rootNode]]),
  };

  const isDirectoryHandle = (handle: OpfsHandle): handle is OpfsDirectoryHandle => handle.kind === "directory";

  const isFileHandle = (handle: OpfsHandle): handle is OpfsFileHandle => handle.kind === "file";

  const traverse = async (handle: OpfsDirectoryHandle, relative: string) => {
    if (isAborted(signal)) return;
    const dirNode = ensureDirectory(relative, context);
    dirNode.children = dirNode.children ?? [];

    try {
      const iterator = handle.entries?.() as AsyncIterableIterator<[string, OpfsHandle]> | undefined;
      if (!iterator) return;

      for await (const [name, childHandle] of iterator) {
        if (isAborted(signal)) return;
        const childRelative = relative ? `${relative}/${name}` : name;

        if (isDirectoryHandle(childHandle)) {
          ensureDirectory(childRelative, context);
          await traverse(childHandle, childRelative);
        } else if (isFileHandle(childHandle)) {
          const absoluteId = toAbsolutePath(context.rootId, childRelative);
          if (!dirNode.children.some((child) => child.id === absoluteId)) {
            dirNode.children.push({
              id: absoluteId,
              name,
            });
          }
        }
      }
    } catch (error) {
      if (!isAbortError(error)) console.warn("Failed to enumerate OPFS directory", error);
    }
  };

  await traverse(rootHandle, "");
  sortTree(rootNode);
  return rootNode;
};

const resolveRootHandle = async (normalizedRoot: string, signal?: AbortSignal) => {
  const rootHandle = await getOpfsRoot(signal);
  if (!rootHandle) return null;

  const segments = normalizedRoot ? normalizedRoot.split("/").filter((segment) => segment.length > 0) : [];
  if (segments.length === 0) return rootHandle;

  return await getDirectoryHandleForPath(rootHandle, segments, signal);
};

const readFileFromOpfs = async (path: string, signal?: AbortSignal) => {
  const rootHandle = await getOpfsRoot(signal);
  if (!rootHandle) return "";

  const segments = path.split("/").filter((segment) => segment.length > 0);
  if (segments.length === 0) return "";

  const fileName = segments[segments.length - 1] ?? "";
  const dirSegments = segments.slice(0, -1);
  const directoryHandle = await getDirectoryHandleForPath(rootHandle, dirSegments, signal);
  if (!directoryHandle) return "";

  try {
    const fileHandle = await directoryHandle.getFileHandle(fileName);
    if (isAborted(signal)) return "";

    const file = await fileHandle.getFile();
    if (isAborted(signal)) return "";

    return await file.text();
  } catch (error) {
    if (!isAbortError(error)) console.warn("Failed to read OPFS file", error);
    return "";
  }
};

export function useFsTree(rootDir: string) {
  const normalizedRoot = useMemo(() => normalizePath(rootDir), [rootDir]);
  const [tree, setTree] = useState<FsNode>(() => createRootNode(normalizedRoot));

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    setTree(createRootNode(normalizedRoot));

    const loadTree = async () => {
      const handle = await resolveRootHandle(normalizedRoot, controller.signal);
      if (!handle) {
        if (active) setTree(createRootNode(normalizedRoot));
        return;
      }

      const nextTree = await buildTreeFromDirectory(handle, normalizedRoot, controller.signal);
      if (active && !isAborted(controller.signal)) {
        setTree(nextTree);
      }
    };

    loadTree().catch((error) => {
      if (!isAbortError(error)) console.warn("Failed to load OPFS tree for file explorer plugin", error);
      if (active) setTree(createRootNode(normalizedRoot));
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [normalizedRoot]);

  return tree;
}

export function useFileContent(filePath: string | null | undefined) {
  const normalizedPath = useMemo(() => normalizePath(filePath), [filePath]);
  const [content, setContent] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    if (!normalizedPath) {
      setContent("");
      return () => {
        active = false;
        controller.abort();
      };
    }

    setContent("");

    const loadContent = async () => {
      const text = await readFileFromOpfs(normalizedPath, controller.signal);
      if (active && !isAborted(controller.signal)) {
        setContent(text);
      }
    };

    loadContent().catch((error) => {
      if (!isAbortError(error)) console.warn("Failed to load OPFS file content", error);
      if (active) setContent("");
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [normalizedPath]);

  return { content };
}
