import type { Ctx } from "./helpers";

export async function cmdEcho(args: string[], _ctx: Ctx, _stdin: string): Promise<string> {
  if (!args.length) return "";

  const out: string[] = [];
  for (const a of args) {
    if (a === "-n" || a === "-e" || a === "-E") continue;
    out.push(a);
  }

  return out.join(" ");
}
