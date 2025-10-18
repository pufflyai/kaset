import { createScopedFs, joinUnderWorkspace } from "@pstdio/opfs-utils";

export interface WorkspaceFs {
  readFile(path: string): Promise<Uint8Array>;
}

interface CreateWorkspaceFsOptions {
  root: string;
}

function normalizeWorkspaceRoot(root: string) {
  return root.replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeWorkspacePath(path: string) {
  const joined = joinUnderWorkspace("", path);
  if (joined === ".") return "";
  return joined.replace(/^\/+/, "");
}

export function createWorkspaceFs(rootOrOptions: CreateWorkspaceFsOptions | string): WorkspaceFs {
  const root = typeof rootOrOptions === "string" ? rootOrOptions : rootOrOptions.root;
  const normalizedRoot = normalizeWorkspaceRoot(root);
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
