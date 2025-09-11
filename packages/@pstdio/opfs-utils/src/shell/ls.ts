import { formatLong, ls } from "../utils/opfs-ls";
import { Ctx, escapeLiteral } from "./helpers";
import { hasParentTraversal, joinPath, normalizeSlashes, parentOf, basename } from "../utils/path";
import { resolveSubdir, getFileHandle } from "../shared";

export async function cmdLs(args: string[], ctx: Ctx): Promise<string> {
  let long = false;
  let all = false;
  let recursive = false;

  const paths: string[] = [];
  for (const a of args) {
    if (a.startsWith("-")) {
      long = long || a.includes("l");
      all = all || a.includes("a");
      recursive = recursive || a.includes("R");
    } else {
      paths.push(a);
    }
  }

  const target = paths[0] ?? ".";
  const normTarget = normalizeSlashes(target);
  if (hasParentTraversal(normTarget)) {
    throw new Error("Parent directory traversal ('..') is not supported");
  }
  const full = normalizeSlashes(joinPath(ctx.cwd, normTarget));

  // Decide if target is a directory or file using adapter helpers
  let relKind: "file" | "directory";
  try {
    await resolveSubdir(full, /*create*/ false);
    relKind = "directory";
  } catch {
    await getFileHandle(full, /*create*/ false);
    relKind = "file";
  }

  if (relKind === "directory") {
    const entries = await ls(full, {
      maxDepth: recursive ? Infinity : 1,
      showHidden: all,
      stat: long,
      sortBy: "name",
      sortOrder: "asc",
      dirsFirst: true,
    });

    return long ? formatLong(entries) : entries.map((e) => e.path).join("\n");
  } else {
    if (long) {
      const parent = parentOf(full);
      const base = basename(full);
      const entries = await ls(parent, {
        maxDepth: 1,
        include: [escapeLiteral(base)],
        showHidden: true,
        stat: true,
      });
      return formatLong(entries.filter((e) => e.path === base));
    } else {
      return basename(normTarget);
    }
  }
}
