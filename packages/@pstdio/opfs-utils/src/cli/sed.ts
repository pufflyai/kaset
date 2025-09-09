import { processSingleFileContent } from "../utils/opfs-files";
import { Ctx, resolveAsFile, unquote } from "./helpers";

export async function cmdSed(args: string[], ctx: Ctx, stdin: string): Promise<string> {
  let quiet = false;
  const positional: string[] = [];

  for (const a of args) {
    if (a === "-n") quiet = true;
    else positional.push(a);
  }

  if (positional.length === 0) throw new Error("sed: missing script");
  const script = unquote(positional[0]);
  const fileArg = positional[1];

  const mRange = /^(\d+),\s*(\d+)p$/.exec(script) || /^(\d+)p$/.exec(script);
  if (!mRange) throw new Error(`sed: unsupported script "${script}" (use 'N,Mp' or 'Np')`);

  const start1 = parseInt(mRange[1], 10);
  const end1 = mRange.length === 3 ? parseInt(mRange[2], 10) : start1;
  const offset = Math.max(0, start1 - 1);
  const limit = Math.max(0, end1 - offset);

  if (fileArg) {
    const { dir, rel } = await resolveAsFile(ctx, fileArg);
    const res = await processSingleFileContent(rel.path, "", dir, offset, limit);
    const text = typeof res.llmContent === "string" ? res.llmContent : String(res.llmContent ?? "");
    return quiet ? text : text;
  } else {
    const lines = (stdin ?? "").split("\n");
    const slice = lines.slice(offset, offset + limit);
    return slice.join("\n");
  }
}

