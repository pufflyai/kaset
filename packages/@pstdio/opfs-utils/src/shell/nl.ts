import { Ctx, resolveAsFile } from "./helpers";
import { getFs } from "../adapter/fs";

export async function cmdNl(args: string[], ctx: Ctx, stdin: string): Promise<string> {
  let bodyMode: "a" | "t" = "t";
  let width = 6;
  let sep = "\t";

  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-")) {
      files.push(a);
      continue;
    }

    if (a === "-b") {
      const v = args[++i];
      if (v === "a" || v === "t") bodyMode = v;
      continue;
    }

    if (a.startsWith("-b") && a.length > 2) {
      const v = a.slice(2);
      if (v === "a" || v === "t") bodyMode = v;
      continue;
    }

    if (a === "-w") {
      const v = parseInt(args[++i] ?? "", 10);
      if (!Number.isNaN(v) && v > 0) width = v;
      continue;
    }

    if (a.startsWith("-w") && a.length > 2) {
      const v = parseInt(a.slice(2), 10);
      if (!Number.isNaN(v) && v > 0) width = v;
      continue;
    }

    if (a === "-s") {
      sep = args[++i] ?? sep;
      continue;
    }

    if (a.startsWith("-s") && a.length > 2) {
      sep = a.slice(2);
      continue;
    }
  }

  let text: string;
  if (files.length > 0) {
    const fileArg = files[0];
    const { full } = await resolveAsFile(ctx, fileArg);
    const fs = await getFs();
    text = await fs.promises.readFile("/" + full, "utf8");
  } else {
    text = stdin ?? "";
  }

  const lines = text.split("\n");
  if (lines.length && lines[lines.length - 1] === "") lines.pop();
  const out: string[] = [];
  let n = 1;

  for (const line of lines) {
    const isEmpty = line.length === 0;
    const shouldNumber = bodyMode === "a" ? true : !isEmpty;
    if (shouldNumber) {
      const num = String(n++).padStart(width, " ");
      out.push(num + sep + line);
    } else {
      out.push("");
    }
  }

  return out.join("\n");
}
