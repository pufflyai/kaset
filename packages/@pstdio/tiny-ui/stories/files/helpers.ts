import { normalizeRoot as normalizeRootValue, writeFile } from "@pstdio/opfs-utils";
import { loadSnapshot } from "@pstdio/tiny-ui-bundler/opfs";

type EntryResolver = string | ((root: string) => string);
type FilesResolver = Record<string, string> | ((root: string) => Record<string, string>);

const normalizeRelativePath = (path: string) => path.replace(/^\/+/, "");

const SNAPSHOT_ROOT_ERROR = "Snapshot root cannot be empty.";

export const normalizeRoot = (root: string) => normalizeRootValue(root, { errorMessage: SNAPSHOT_ROOT_ERROR });

export const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const resolve = <T>(value: T | ((root: string) => T), root: string): T =>
  typeof value === "function" ? (value as (r: string) => T)(root) : value;

const toDuration = (start: number | null, end: number) =>
  typeof start === "number" ? Math.max(0, Math.round(end - start)) : null;

export interface LifecycleTimings {
  total: number | null;
  initialize: number | null;
  compile: number | null;
  handshake: number | null;
}

export const calculateLifecycleTimings = ({
  initStart,
  compileStart,
  handshakeStart,
  completedAt,
}: {
  initStart: number | null;
  compileStart: number | null;
  handshakeStart: number | null;
  completedAt: number;
}): LifecycleTimings => {
  const total = toDuration(initStart, completedAt);
  const handshake = toDuration(handshakeStart, completedAt);

  let compile: number | null = null;
  if (typeof compileStart === "number") {
    const compileEnd = typeof handshakeStart === "number" ? handshakeStart : completedAt;
    compile = Math.max(0, Math.round(compileEnd - compileStart));
  }

  let initialize: number | null = null;
  if (typeof initStart === "number" && typeof compileStart === "number") {
    initialize = Math.max(0, Math.round(compileStart - initStart));
  } else if (total !== null) {
    const compileValue = compile ?? 0;
    const handshakeValue = handshake ?? 0;
    const remainder = total - compileValue - handshakeValue;
    initialize = Math.max(0, remainder);
  }

  return { total, initialize, compile, handshake };
};

export const formatLifecycleTimings = ({ total, initialize, compile, handshake }: LifecycleTimings) => {
  if (total === null) return "";

  const details: string[] = [];
  if (initialize !== null) {
    details.push(`initialize ${initialize}ms`);
  }
  if (compile !== null) {
    details.push(`compile ${compile}ms`);
  }
  if (handshake !== null) {
    details.push(`handshake ${handshake}ms`);
  }

  const detailSuffix = details.length > 0 ? ` (${details.join(", ")})` : "";
  return ` in ${total}ms${detailSuffix}`;
};

export const writeSnapshotFiles = async (root: string, entry: EntryResolver, files: FilesResolver) => {
  const folder = normalizeRoot(root);
  const entryPath = resolve(entry, root);
  const fileMap = resolve(files, root);

  await Promise.all(
    Object.entries(fileMap).map(([relativePath, source]) =>
      writeFile(`${folder}/${normalizeRelativePath(relativePath)}`, source),
    ),
  );

  await loadSnapshot(folder, entryPath);
};

export interface SnapshotInitializerOptions {
  entry: EntryResolver;
  files: FilesResolver;
}

export const createSnapshotInitializer = ({ entry, files }: SnapshotInitializerOptions) => {
  const inFlight = new Map<string, Promise<void>>();

  return (root: string) => {
    const normalized = normalizeRoot(root);
    let promise = inFlight.get(normalized);

    if (!promise) {
      promise = writeSnapshotFiles(root, entry, files).catch((error) => {
        inFlight.delete(normalized);
        throw error;
      });

      inFlight.set(normalized, promise);
    }

    return promise;
  };
};
