import { createScopedFs, joinUnderWorkspace } from "@pstdio/opfs-utils";
import type { WorkspaceFs } from "./types";

interface CreateWorkspaceFsOptions {
  root: string;
}

function normalizeRoot(root: string) {
  return root.replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeWorkspacePath(path: string) {
  const joined = joinUnderWorkspace("", path);
  if (joined === ".") return "";
  return joined.replace(/^\/+/, "");
}

export function createWorkspaceFs(rootOrOptions: CreateWorkspaceFsOptions | string): WorkspaceFs {
  const root = typeof rootOrOptions === "string" ? rootOrOptions : rootOrOptions.root;
  const normalizedRoot = normalizeRoot(root);
  const fs = createScopedFs(normalizedRoot);

  return {
    async readFile(path: string) {
      const rel = normalizeWorkspacePath(path);
      if (!rel) {
        throw new Error("workspace.readFile requires a relative file path");
      }
      return fs.readFile(rel);
    },
  };
}
