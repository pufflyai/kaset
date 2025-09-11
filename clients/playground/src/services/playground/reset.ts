import { PROJECTS_ROOT } from "@/constant";
import { deleteFile, ls } from "@pstdio/opfs-utils";
import { resetConversationsForProject } from "./reset-conversations";
import { setupExample, type ExampleKind } from "./setup";

export type ResetOptions = {
  /** OPFS root folder name. Defaults to `${PROJECTS_ROOT}/${kind}`. */
  folderName?: string;
};

/**
 * Reset a playground project: remove all files under the project's OPFS folder
 * and re-apply the bundled example files.
 */
export async function resetProject(kind: ExampleKind, options: ResetOptions = {}) {
  const rootDir = options.folderName?.trim() || `${PROJECTS_ROOT}/${kind}`;

  let deleted = 0;
  try {
    // Remove all files recursively under the project directory
    const files = await ls(rootDir, { maxDepth: Infinity, kinds: ["file"] });
    for (const f of files) {
      try {
        await deleteFile(`${rootDir}/${f.path}`);
        deleted++;
      } catch (err) {
        console.warn(`Failed to remove ${f.path} during reset:`, err);
      }
    }
  } catch (err) {
    // Project directory may not exist yet; that's fine — we'll recreate it below
    console.warn(`Project directory not found for reset (${rootDir}); will recreate.`, err);
  }

  let written = 0;
  try {
    const result = await setupExample(kind, { folderName: rootDir, overwrite: true });
    written = result.written;
  } catch (err) {
    console.error(`Failed to setup example for ${kind}:`, err);
  }

  // Remove all conversations for this project and create a fresh empty one.
  try {
    resetConversationsForProject(kind);
  } catch (err) {
    console.warn("Failed to reset conversations for project", kind, err);
  }

  return { rootDir, deleted, written };
}
