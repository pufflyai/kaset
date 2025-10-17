import * as esbuild from "esbuild-wasm";

import { RESOLVE_EXTENSIONS } from "../../constants";
import type { SnapshotFileMap } from "../../types";
import { ensureLeadingSlash, joinPath, loaderFromPath } from "../../utils";

const VIRTUAL_NAMESPACE = "kaset-virtual";

const findFileCandidate = (files: SnapshotFileMap, path: string) => {
  if (files[path]) return path;

  for (const extension of RESOLVE_EXTENSIONS) {
    if (extension && path.endsWith(extension)) continue;
    const candidate = `${path}${extension}`;
    if (files[candidate]) return candidate;
  }

  if (!path.endsWith("/")) {
    for (const extension of RESOLVE_EXTENSIONS) {
      const candidate = `${path}/index${extension}`;
      if (files[candidate]) return candidate;
    }
  }

  return null;
};

export const createVirtualFsPlugin = (files: SnapshotFileMap, entry: string): esbuild.Plugin => ({
  name: "kaset-virtual-fs",
  setup(build) {
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.kind === "entry-point") {
        return { path: entry, namespace: VIRTUAL_NAMESPACE };
      }

      if (args.namespace === VIRTUAL_NAMESPACE) {
        if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
          return null;
        }

        const importer = args.importer ? ensureLeadingSlash(args.importer) : entry;
        const tentative = joinPath(importer, args.path);
        const resolved = findFileCandidate(files, tentative);
        if (resolved) {
          return { path: resolved, namespace: VIRTUAL_NAMESPACE };
        }

        if (args.path.startsWith("/")) {
          const absolute = findFileCandidate(files, ensureLeadingSlash(args.path));
          if (absolute) {
            return { path: absolute, namespace: VIRTUAL_NAMESPACE };
          }
        }

        return null;
      }

      if (args.path.startsWith(".") || args.path.startsWith("/")) {
        const importer = args.importer ? ensureLeadingSlash(args.importer) : entry;
        const tentative = joinPath(importer, args.path);
        const resolved = findFileCandidate(files, tentative);
        if (resolved) {
          return { path: resolved, namespace: VIRTUAL_NAMESPACE };
        }
      }

      return null;
    });

    build.onLoad({ filter: /.*/, namespace: VIRTUAL_NAMESPACE }, async (args) => {
      const contents = files[args.path];
      if (contents === undefined) {
        throw new Error(`Virtual module not found: ${args.path}`);
      }

      return {
        contents,
        loader: loaderFromPath(args.path),
      } satisfies esbuild.OnLoadResult;
    });
  },
});
