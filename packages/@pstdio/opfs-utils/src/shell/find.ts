import { globToRegExp as globToRegExpGrep } from "../utils/opfs-grep";
import { ls } from "../utils/opfs-ls";
import { basename, joinPath, normalizeSlashes } from "../utils/path";
import { resolveSubdir, getFileHandle } from "../shared.migrated";
import { Ctx } from "./helpers";

export async function cmdFind(args: string[], ctx: Ctx): Promise<string> {
  let startPathArg: string | undefined;
  let namePattern: string | undefined;
  let typeFilter: "file" | "directory" | undefined;
  let maxdepth: number | undefined;
  let mindepth = 0;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-name") {
      namePattern = args[++i];
    } else if (a === "-type") {
      const t = args[++i];
      if (t === "f") typeFilter = "file";
      else if (t === "d") typeFilter = "directory";
    } else if (a === "-maxdepth") {
      const v = parseInt(args[++i] ?? "", 10);
      if (!Number.isNaN(v) && v >= 0) maxdepth = v;
    } else if (a === "-mindepth") {
      const v = parseInt(args[++i] ?? "", 10);
      if (!Number.isNaN(v) && v >= 0) mindepth = v;
    } else if (!a.startsWith("-")) {
      if (startPathArg == null) startPathArg = a;
    }
  }

  const target = startPathArg ?? ".";
  const normTarget = normalizeSlashes(target);
  const full = normalizeSlashes(joinPath(ctx.cwd, normTarget));

  let relKind: "file" | "directory";
  try {
    await resolveSubdir(full, /*create*/ false);
    relKind = "directory";
  } catch {
    await getFileHandle(full, /*create*/ false);
    relKind = "file";
  }

  const nameRE = namePattern ? globToRegExpGrep(namePattern) : undefined;
  const out: string[] = [];

  const matchesFilters = (entry: { name: string; kind: "file" | "directory"; depth: number }): boolean => {
    if (typeFilter && entry.kind !== typeFilter) return false;
    if (nameRE && !nameRE.test(entry.name)) return false;
    if (entry.depth < mindepth) return false;
    if (maxdepth != null && entry.depth > maxdepth) return false;
    return true;
  };

  if (relKind === "directory") {
    if (mindepth <= 0) {
      const includeStart = matchesFilters({
        name: normTarget === "." ? "." : basename(normTarget),
        kind: "directory",
        depth: 0,
      });
      if (includeStart) out.push(normTarget);
    }

    const entries = await ls(full, {
      maxDepth: maxdepth == null ? Infinity : Math.max(0, maxdepth),
      showHidden: true,
      kinds: ["file", "directory"],
      stat: false,
      dirsFirst: false,
    });

    for (const e of entries) {
      const depthFromStart = e.depth;
      const candidate = { name: e.name, kind: e.kind, depth: depthFromStart };
      if (!matchesFilters(candidate)) continue;
      const printed = normTarget === "." ? e.path : `${normTarget}/${e.path}`;
      out.push(printed);
    }
  } else {
    if (mindepth <= 0) {
      const include = matchesFilters({ name: basename(full), kind: "file", depth: 0 });
      if (include) out.push(normTarget);
    }
  }

  return out.join("\n");
}
