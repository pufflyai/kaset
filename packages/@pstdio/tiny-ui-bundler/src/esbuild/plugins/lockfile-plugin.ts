import * as esbuild from "esbuild-wasm";

import type { Lockfile } from "../../core/import-map";
import { isHttpUrl, loaderFromPath } from "../../utils";
import { REMOTE_NAMESPACE } from "../../constants";

const createRemoteResolver = (lockfile: Lockfile) => {
  const resolveFromLockfile = (specifier: string) => lockfile?.[specifier] ?? null;

  const resolveRemote = (specifier: string, importer?: string) => {
    if (isHttpUrl(specifier)) {
      return { path: specifier, namespace: REMOTE_NAMESPACE } satisfies esbuild.OnResolveResult;
    }

    const mapped = resolveFromLockfile(specifier);
    if (mapped) {
      return { path: mapped, namespace: REMOTE_NAMESPACE } satisfies esbuild.OnResolveResult;
    }

    if (
      importer &&
      isHttpUrl(importer) &&
      (specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/"))
    ) {
      const resolved = new URL(specifier, importer).toString();
      return { path: resolved, namespace: REMOTE_NAMESPACE } satisfies esbuild.OnResolveResult;
    }

    return null;
  };

  return resolveRemote;
};

export const createLockfilePlugin = (lockfile: Lockfile | null): esbuild.Plugin | null => {
  if (!lockfile || Object.keys(lockfile).length === 0) return null;

  const resolveRemote = createRemoteResolver(lockfile);

  return {
    name: "kaset-remote-deps",
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.namespace === REMOTE_NAMESPACE) {
          const resolved = resolveRemote(args.path, args.importer);
          if (resolved) return resolved;
          if (isHttpUrl(args.path)) {
            return { path: args.path, namespace: REMOTE_NAMESPACE } satisfies esbuild.OnResolveResult;
          }
          return null;
        }

        if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
          const resolved = resolveRemote(args.path, args.importer);
          if (resolved) return resolved;
        }

        if (isHttpUrl(args.path)) {
          return { path: args.path, namespace: REMOTE_NAMESPACE } satisfies esbuild.OnResolveResult;
        }

        return null;
      });

      build.onLoad({ filter: /.*/, namespace: REMOTE_NAMESPACE }, async (args) => {
        if (typeof fetch !== "function") {
          throw new Error("Global fetch API is unavailable for remote module resolution");
        }

        const response = await fetch(args.path);
        if (!response.ok) {
          throw new Error(`Failed to fetch remote module ${args.path}: ${response.status} ${response.statusText}`);
        }

        const contents = await response.text();

        return {
          contents,
          loader: loaderFromPath(args.path),
        } satisfies esbuild.OnLoadResult;
      });
    },
  } satisfies esbuild.Plugin;
};
