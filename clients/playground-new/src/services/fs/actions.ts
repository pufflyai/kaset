import { deleteFile, ls } from "@pstdio/opfs-utils";

export async function deleteFileNode(args: {
  rootDir: string;
  nodeId: string;
  selectedPath?: string | null;
}): Promise<string | null | undefined> {
  const { rootDir, nodeId, selectedPath } = args;

  const norm = (p?: string) => (p ? p.split("/").filter(Boolean).join("/") : "");

  const idParts = norm(nodeId).split("/").filter(Boolean);
  const rootParts = norm(rootDir).split("/").filter(Boolean);

  const hasRootPrefix = idParts.slice(0, rootParts.length).join("/") === norm(rootDir);
  const relParts = hasRootPrefix ? idParts.slice(rootParts.length) : idParts;

  const target = hasRootPrefix ? norm(nodeId) : [norm(rootDir), ...idParts].filter(Boolean).join("/");
  await deleteFile(target);

  // If the deleted node was the selected file, suggest a new selection.
  if ((selectedPath ?? null) !== nodeId) return undefined;

  const dirRelParts = relParts.slice(0, -1);
  const dirRelPath = dirRelParts.join("/");
  const currentDirPath = [rootDir, dirRelPath].filter(Boolean).join("/");
  const siblings = await ls(currentDirPath, { maxDepth: 1, kinds: ["file"], sortBy: "name" });

  const toAbs = (name: string) => [rootDir, dirRelPath, name].filter((s) => !!s && s.length > 0).join("/");

  if (siblings.length > 0) {
    return toAbs(siblings[0].name);
  }

  const all = await ls(rootDir, {
    maxDepth: Infinity,
    kinds: ["file"],
    sortBy: "path",
    dirsFirst: false,
  });

  if (all.length > 0) {
    return [rootDir, all[0].path].filter(Boolean).join("/");
  }

  return null;
}
