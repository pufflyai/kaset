import { grep } from "../utils/opfs-grep";
import { Ctx, resolveAsDir, unquote } from "./helpers";

export async function cmdRg(args: string[], ctx: Ctx): Promise<string> {
  let showLineNums = false;
  let smartCase = false;

  const positional: string[] = [];

  for (const a of args) {
    if (a === "-n") showLineNums = true;
    else if (a === "-S") smartCase = true;
    else positional.push(a);
  }

  if (positional.length === 0) throw new Error("rg: missing pattern");
  const rawPattern = unquote(positional[0]);
  const searchPath = positional[1] ?? ".";

  let flags = "";
  if (smartCase && !/[A-Z]/.test(rawPattern)) flags += "i";

  const re = new RegExp(rawPattern, flags.includes("g") ? flags : flags + "g");
  const { dir } = await resolveAsDir(searchPath, ctx);

  const matches = await grep(dir, {
    pattern: re,
    exclude: ["**/node_modules/**", "**/.git/**"],
    onMatch: undefined,
  });

  return matches
    .map((m) =>
      showLineNums ? `${m.file}:${m.line}:${m.column}: ${m.lineText}` : `${m.file}:${m.line}:${m.column}: ${m.match}`,
    )
    .join("\n");
}

