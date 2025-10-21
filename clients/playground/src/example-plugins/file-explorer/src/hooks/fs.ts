import { useEffect, useState } from "react";
import type { FsScope, TinyUiHost } from "../host";

export interface FsNode {
  id: string;
  name: string;
  children?: FsNode[];
}

type LsEntry = { path: string; kind: "file" | "directory" };

const POLL_INTERVAL_MS = 2000;

const norm = (s?: string | null) =>
  (s || "")
    .split("/")
    .map((x) => x.trim())
    .filter(Boolean)
    .join("/");

const join = (a: string, b: string) => {
  const A = norm(a),
    B = norm(b);
  return A && B ? `${A}/${B}` : A || B || "/";
};

const base = (p?: string | null) => {
  const n = norm(p);
  return n ? n.split("/").pop()! : "/";
};

const absRoot = (scopeRoot?: string | null, root?: string | null) => {
  const s = norm(scopeRoot),
    r = norm(root);
  if (!r) return s || "/";
  if (!s) return r;
  return r === s || r.startsWith(`${s}/`) ? r : `${s}/${r}`;
};

const buildTree = (entries: LsEntry[], rootId: string, rootName: string): FsNode => {
  const root: FsNode = { id: rootId || "/", name: rootName || "/", children: [] };
  const dirs = new Map<string, FsNode>([["", root]]);

  const ensureDir = (rel: string) => {
    const key = norm(rel);
    if (!key) return root;
    let path = "";
    for (const seg of key.split("/")) {
      path = path ? `${path}/${seg}` : seg;
      if (!dirs.has(path)) {
        const node: FsNode = { id: join(rootId, path), name: seg, children: [] };
        const parent = dirs.get(path.split("/").slice(0, -1).join("/")) || root;
        (parent.children ||= []).push(node);
        dirs.set(path, node);
      }
    }
    return dirs.get(key)!;
  };

  const files = new Set<string>();
  for (const e of entries) {
    const rel = norm(e.path);
    if (!rel) continue;
    if (e.kind === "directory") {
      ensureDir(rel);
      continue;
    }
    const parts = rel.split("/");
    const file = parts.pop()!;
    const parent = ensureDir(parts.join("/"));
    const id = join(rootId, rel);
    if (!files.has(id)) {
      (parent.children ||= []).push({ id, name: file });
      files.add(id);
    }
  }

  const sort = (n: FsNode) => {
    n.children?.sort(
      (a, b) =>
        Number(!!b.children) - Number(!!a.children) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
    n.children?.forEach(sort);
  };
  sort(root);
  return root;
};

export function useFsTree(host: TinyUiHost, rootDir: string, scope: FsScope) {
  const root = norm(rootDir);
  const fallback: FsNode = { id: root || "/", name: base(root), children: [] };
  const [tree, setTree] = useState<FsNode>(fallback);
  const recursiveDepth = Number.MAX_SAFE_INTEGER;

  useEffect(() => {
    let cancelled = false;
    let running = false;
    let intervalId: number | null = null;

    const refreshSafely = async () => {
      if (cancelled || running) return;
      running = true;

      let scopeRoot = "";

      try {
        scopeRoot = await host.call("fs.getScopeRoot", { scope });
        // host.call serializes payloads via JSON, so avoid Infinity (serializes to null) for recursive listing.
        const entries: LsEntry[] = await host.call("fs.ls", {
          path: root,
          scope,
          options: { maxDepth: recursiveDepth },
        });
        if (!cancelled) {
          setTree(buildTree(entries, absRoot(scopeRoot, root), base(root || scopeRoot)));
        }
      } catch {
        if (!cancelled) {
          setTree({ id: absRoot(scopeRoot, root), name: base(root || scopeRoot), children: [] });
        }
      } finally {
        running = false;
      }
    };

    setTree(fallback);
    refreshSafely().catch(() => undefined);

    if (typeof window !== "undefined" && typeof window.setInterval === "function") {
      intervalId = window.setInterval(() => {
        refreshSafely().catch(() => undefined);
      }, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (intervalId != null && typeof window !== "undefined" && typeof window.clearInterval === "function") {
        window.clearInterval(intervalId);
      }
    };
  }, [host, root, scope]);

  return tree;
}
