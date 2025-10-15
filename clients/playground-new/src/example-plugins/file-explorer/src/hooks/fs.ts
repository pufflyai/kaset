import { useEffect, useMemo, useState } from "react";

export interface FsNode {
  id: string;
  name: string;
  children?: FsNode[];
}

interface TinyFsEntry {
  path: string;
  name: string;
  kind: "file" | "directory";
  depth: number;
  size?: number;
  lastModified?: number;
}

interface TinyFsDirSnapshot {
  dir: string;
  entries: TinyFsEntry[];
  signature?: string;
  generatedAt?: number;
}

interface WorkspaceApi {
  dirSnapshot?(dir?: string): Promise<TinyFsDirSnapshot>;
  readFile?(path: string): Promise<Uint8Array | string | ArrayBuffer | ArrayBufferView>;
}

export interface WorkspaceHost {
  workspace?: WorkspaceApi | null;
  call?(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

interface WorkspaceAdapter {
  dirSnapshot(path: string, signal?: AbortSignal): Promise<TinyFsDirSnapshot>;
  readFile(path: string, signal?: AbortSignal): Promise<string>;
}

const textDecoder = new TextDecoder();

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
  const absoluteId =
    context.rootId === "/" ? relative || "/" : relative ? `${context.rootId}/${relative}` : context.rootId;

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

const isArrayBufferView = (value: unknown): value is ArrayBufferView =>
  Boolean(value) && ArrayBuffer.isView(value as ArrayBufferView);

const decodeBytes = (value: Uint8Array | string | ArrayBuffer | ArrayBufferView) => {
  if (typeof value === "string") return value;
  if (value instanceof Uint8Array) return textDecoder.decode(value);
  if (value instanceof ArrayBuffer) return textDecoder.decode(new Uint8Array(value));
  if (isArrayBufferView(value)) return textDecoder.decode(new Uint8Array(value.buffer));
  throw new Error("Tiny UI workspace.readFile returned unsupported data");
};

const createSignature = (entries: TinyFsEntry[]) => {
  if (!Array.isArray(entries) || entries.length === 0) return "0";
  return entries
    .slice()
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    .map((entry) => {
      const modified = entry.lastModified == null ? "" : String(entry.lastModified);
      const size = entry.size == null ? "" : String(entry.size);
      return `${entry.path}|${entry.kind}|${modified}|${size}`;
    })
    .join(";");
};

const createWorkspaceAdapter = (host: WorkspaceHost | null | undefined): WorkspaceAdapter | null => {
  if (!host) return null;

  const workspace = host.workspace ?? null;
  const call = typeof host.call === "function" ? host.call.bind(host) : null;

  const dirSnapshot = async (dir: string, signal?: AbortSignal) => {
    if (signal?.aborted) {
      return { dir, entries: [], signature: "0", generatedAt: Date.now() } satisfies TinyFsDirSnapshot;
    }

    let result: unknown;

    if (workspace && typeof workspace.dirSnapshot === "function") {
      result = await workspace.dirSnapshot(dir);
    } else if (call) {
      result = await call("workspace.dirSnapshot", { dir });
    } else {
      throw new Error("Tiny UI host workspace.dirSnapshot is not available");
    }

    if (!result || typeof result !== "object") {
      throw new Error("Tiny UI workspace.dirSnapshot returned invalid data");
    }

    const snapshot = result as TinyFsDirSnapshot;
    snapshot.dir = typeof snapshot.dir === "string" ? snapshot.dir : dir;
    snapshot.entries = Array.isArray(snapshot.entries) ? snapshot.entries : [];
    snapshot.signature = snapshot.signature ?? createSignature(snapshot.entries);
    return snapshot;
  };

  const readFile = async (path: string, signal?: AbortSignal) => {
    if (signal?.aborted) return "";

    let result: unknown;

    if (workspace && typeof workspace.readFile === "function") {
      result = await workspace.readFile(path);
    } else if (call) {
      result = await call("workspace.readFile", { path });
    } else {
      throw new Error("Tiny UI host workspace.readFile is not available");
    }

    if (result == null) return "";
    return decodeBytes(result as Uint8Array | string | ArrayBuffer | ArrayBufferView);
  };

  return { dirSnapshot, readFile };
};

const buildTreeFromSnapshot = (normalizedRoot: string, snapshot: TinyFsDirSnapshot) => {
  const rootNode = createRootNode(normalizedRoot);
  const context = {
    rootId: rootNode.id,
    rootName: rootNode.name,
    nodeMap: new Map<string, FsNode>([["", rootNode]]),
  };

  const sortedEntries = snapshot.entries.slice().sort((a, b) => {
    if (a.depth === b.depth) return a.path.localeCompare(b.path);
    return a.depth - b.depth;
  });

  for (const entry of sortedEntries) {
    const relative = entry.path.replace(/^\/+/, "");
    const parentRelative = relative.includes("/") ? relative.slice(0, relative.lastIndexOf("/")) : "";

    if (entry.kind === "directory") {
      ensureDirectory(relative, context);
      continue;
    }

    const parentNode = ensureDirectory(parentRelative, context);
    parentNode.children = parentNode.children ?? [];

    const absoluteId =
      context.rootId === "/"
        ? relative || "/"
        : parentRelative
          ? `${context.rootId}/${relative}`
          : `${context.rootId}/${entry.name}`;

    if (!parentNode.children.some((child) => child.id === absoluteId)) {
      parentNode.children.push({
        id: absoluteId,
        name: entry.name,
      });
    }
  }

  sortTree(rootNode);
  return rootNode;
};

export function useFsTree(host: WorkspaceHost | null | undefined, rootDir: string) {
  const normalizedRoot = useMemo(() => normalizePath(rootDir), [rootDir]);
  const [tree, setTree] = useState<FsNode>(() => createRootNode(normalizedRoot));

  useEffect(() => {
    const adapter = createWorkspaceAdapter(host);
    if (!adapter) {
      setTree(createRootNode(normalizedRoot));
      return () => undefined;
    }

    let active = true;
    const controller = new AbortController();
    let lastSignature: string | null = null;

    const refresh = async (emitInitial: boolean) => {
      if (!active) return;
      try {
        const snapshot = await adapter.dirSnapshot(normalizedRoot, controller.signal);
        if (!active || controller.signal.aborted) return;

        const signature = snapshot.signature ?? createSignature(snapshot.entries);
        if (!emitInitial && signature === lastSignature) return;

        lastSignature = signature;
        setTree(buildTreeFromSnapshot(normalizedRoot, snapshot));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[file-explorer] Failed to refresh workspace tree", error);
          if (emitInitial) {
            setTree(createRootNode(normalizedRoot));
          }
        }
      }
    };

    void refresh(true);

    const interval = setInterval(() => {
      void refresh(false);
    }, 2000);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [host, normalizedRoot]);

  return tree;
}

export function useFileContent(host: WorkspaceHost | null | undefined, filePath: string | null | undefined) {
  const normalizedPath = useMemo(() => normalizePath(filePath), [filePath]);
  const [content, setContent] = useState("");

  useEffect(() => {
    const adapter = createWorkspaceAdapter(host);
    if (!adapter) {
      setContent("");
      return () => undefined;
    }

    let active = true;
    const controller = new AbortController();

    if (!normalizedPath) {
      setContent("");
      return () => {
        active = false;
        controller.abort();
      };
    }

    const load = async () => {
      try {
        const text = await adapter.readFile(normalizedPath, controller.signal);
        if (active && !controller.signal.aborted) {
          setContent(text);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn("[file-explorer] Failed to read workspace file", error);
          if (active) setContent("");
        }
      }
    };

    setContent("");
    load().catch((error) => {
      if (!controller.signal.aborted) {
        console.warn("[file-explorer] Failed to load workspace file", error);
        if (active) setContent("");
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [host, normalizedPath]);

  return { content };
}
