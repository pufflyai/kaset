import { normalizeSlashes } from "../utils/path";
import { Ctx, resolveAsFile } from "./helpers";
import { getFs } from "../adapter/fs";

export async function cmdWc(args: string[], ctx: Ctx, stdin: string): Promise<string> {
  let wantLines = false;
  let wantWords = false;
  let wantBytes = false;

  const files: string[] = [];

  for (const a of args) {
    if (a === "-l") wantLines = true;
    else if (a === "-w") wantWords = true;
    else if (a === "-c") wantBytes = true;
    else if (!a.startsWith("-")) files.push(a);
  }

  if (!wantLines && !wantWords && !wantBytes) {
    wantLines = wantWords = wantBytes = true;
  }

  type Counts = { lines: number; words: number; bytes: number };
  const totals: Counts = { lines: 0, words: 0, bytes: 0 };

  const formatCounts = (c: Counts, label?: string) => {
    const parts: string[] = [];
    if (wantLines) parts.push(String(c.lines));
    if (wantWords) parts.push(String(c.words));
    if (wantBytes) parts.push(String(c.bytes));
    return label ? parts.join("\t") + "\t" + label : parts.join("\t");
  };

  const lines: string[] = [];

  if (files.length === 0) {
    const c = countText(stdin ?? "");
    return formatCounts(c);
  }

  const fs = await getFs();
  for (const fileArg of files) {
    const { full } = await resolveAsFile(ctx, fileArg);
    const text = await fs.promises.readFile("/" + normalizeSlashes(full), "utf8");

    const c = countText(text);
    totals.lines += c.lines;
    totals.words += c.words;
    totals.bytes += c.bytes;

    const label = normalizeSlashes(fileArg);
    lines.push(formatCounts(c, label));
  }

  if (files.length > 1) {
    lines.push(formatCounts(totals, "total"));
  }

  return lines.join("\n");
}

function countText(text: string): { lines: number; words: number; bytes: number } {
  const lines = text === "" ? 0 : (text.match(/\n/g) || []).length;

  const trimmed = text.trim();
  const words = trimmed ? (trimmed.match(/\S+/g) || []).length : 0;

  let bytes = 0;

  if (typeof TextEncoder !== "undefined") {
    bytes = new TextEncoder().encode(text).length;
  } else if (typeof Blob !== "undefined") {
    // Works in browsers and modern Node; defaults to UTF-8 for strings
    bytes = new Blob([text]).size;
  } else {
    // Final fallback without relying on Buffer in browser contexts
    // encodeURIComponent produces UTF-8 percent-encoded bytes
    bytes = unescape(encodeURIComponent(text)).length;
  }

  return { lines, words, bytes };
}
