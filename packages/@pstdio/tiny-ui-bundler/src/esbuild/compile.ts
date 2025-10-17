import * as esbuild from "esbuild-wasm";

import { getVirtualPrefix } from "../constants";
import { publishBundleToSW } from "../cache/cache";
import { getCachedBundle, setCachedCompileResult } from "../cache/cache-manifest";
import { computeHash, computeLockfileHash } from "../core/hash";
import { getLockfile } from "../core/idb";
import { readSnapshot } from "../core/snapshot";
import { getSource } from "../core/sources";
import { ensureLeadingSlash } from "../utils";
import { ENTRY_NAME, OUTPUT_DIR } from "../constants";
import { createLockfilePlugin } from "./plugins/lockfile-plugin";
import { createVirtualFsPlugin } from "./plugins/virtual-fs-plugin";
import type { BuildWithEsbuildOptions, CompileResult, SnapshotFileMap } from "../types";

let initializePromise: Promise<void> | null = null;

const createCompileResult = (params: {
  id: string;
  hash: string;
  lockfileHash: string;
  fromCache: boolean;
  bytes: number;
  assets: string[];
}): CompileResult => ({
  id: params.id,
  hash: params.hash,
  url: `${getVirtualPrefix()}${params.hash}.js`,
  fromCache: params.fromCache,
  bytes: params.bytes,
  assets: params.assets,
  lockfileHash: params.lockfileHash,
});

const ensureInitialized = (wasmURL: string) => {
  if (!initializePromise) {
    initializePromise = esbuild.initialize({
      wasmURL,
      worker: true,
    });
  }

  return initializePromise;
};

const getContentType = (path: string) => {
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".json") || path.endsWith(".map")) return "application/json";
  return "application/javascript";
};

const toVirtualAssetPath = (path: string) => {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return normalized.startsWith(`${OUTPUT_DIR}/`) ? normalized.slice(OUTPUT_DIR.length + 1) : normalized;
};

export const compile = async (id: string, options: BuildWithEsbuildOptions): Promise<CompileResult> => {
  const { wasmURL, define, skipCache = false } = options;
  await ensureInitialized(wasmURL);

  const source = getSource(id);
  if (!source) throw new Error(`Source not registered for id: ${id}`);

  const snapshot = await readSnapshot(source);
  const lockfile = getLockfile();
  const lockfileHash = await computeLockfileHash(lockfile ?? null);

  const hash = await computeHash({
    id,
    root: source.root,
    entryRelativePath: snapshot.entryRelative,
    digests: snapshot.digests,
    tsconfig: snapshot.tsconfig ?? null,
    lockfile: lockfile ?? null,
  });

  if (!skipCache) {
    const cached = await getCachedBundle(id);
    if (cached && cached.hash === hash) {
      return cached;
    }
  }

  const files: SnapshotFileMap = { ...snapshot.files };
  const entry = ensureLeadingSlash(snapshot.entryRelative);
  const remotePlugin = createLockfilePlugin(lockfile ?? null);
  const plugins = [createVirtualFsPlugin(files, entry)];

  if (remotePlugin) {
    plugins.push(remotePlugin);
  }

  const buildResult = await esbuild.build({
    entryPoints: { [ENTRY_NAME]: entry },
    platform: "browser",
    format: "esm",
    bundle: true,
    metafile: true,
    write: false,
    jsx: "automatic",
    jsxImportSource: "react",
    sourcemap: "external",
    target: "es2022",
    logLevel: "silent",
    outdir: OUTPUT_DIR,
    entryNames: ENTRY_NAME,
    chunkNames: "chunks/[name]-[hash]",
    assetNames: "assets/[name]-[hash]",
    plugins,
    loader: {
      ".ts": "ts",
      ".tsx": "tsx",
      ".js": "js",
      ".jsx": "jsx",
      ".json": "json",
      ".css": "css",
    },
    define: {
      "process.env.NODE_ENV": '"production"',
      ...define,
    },
  });

  const outputs = buildResult.outputFiles ?? [];
  const outputByPath = new Map(outputs.map((file) => [file.path.replace(/^[.\\/]+/, ""), file]));

  const entryOutputPath = Object.entries(buildResult.metafile?.outputs ?? {}).find(
    ([, details]) => details.entryPoint,
  )?.[0];

  if (!entryOutputPath) {
    throw new Error("esbuild did not emit an entry chunk");
  }

  const normalizedEntryPath = entryOutputPath.replace(/^[.\\/]+/, "");
  const entryFile = outputByPath.get(normalizedEntryPath);
  if (!entryFile) {
    throw new Error(`Missing entry output: ${normalizedEntryPath}`);
  }

  const entryBytes = entryFile.contents.byteLength;

  const assetFiles = outputs.filter((file) => file !== entryFile);
  const publishedAssets = assetFiles.map((file) => {
    const assetPath = toVirtualAssetPath(file.path);
    return {
      path: assetPath,
      source: file.text,
      init: {
        headers: {
          "Content-Type": getContentType(assetPath),
        },
      } satisfies ResponseInit,
      bytes: file.contents.byteLength,
    };
  });

  await publishBundleToSW({
    hash,
    entry: {
      source: entryFile.text,
      init: {
        headers: {
          "Content-Type": "application/javascript",
        },
      },
    },
    assets: publishedAssets.map(({ path, source, init }) => ({ path, source, init })),
  });

  const totalBytes = entryBytes + publishedAssets.reduce((sum, asset) => sum + asset.bytes, 0);
  const assetPaths = publishedAssets.map((asset) => asset.path);

  const result = createCompileResult({
    id,
    hash,
    lockfileHash,
    fromCache: false,
    bytes: totalBytes,
    assets: assetPaths,
  });

  await setCachedCompileResult(id, result);

  return result;
};
