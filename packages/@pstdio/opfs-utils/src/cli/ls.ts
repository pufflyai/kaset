import { formatLong, ls } from "../utils/opfs-ls";
import { Ctx, escapeLiteral, resolveAsDirOrFile } from "./helpers";

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
  const { dir, rel } = await resolveAsDirOrFile(ctx, target);

  if (rel.kind === "directory") {
    const entries = await ls(dir, {
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
      const entries = await ls(dir, {
        maxDepth: 1,
        include: [escapeLiteral(rel.path)],
        showHidden: true,
        stat: true,
      });
      return formatLong(entries.filter((e) => e.path === rel.path));
    } else {
      return rel.path;
    }
  }
}
