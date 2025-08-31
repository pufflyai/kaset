import {
  TemplateTag,
  commaListsAnd,
  commaListsOr,
  html,
  oneLineCommaListsAnd,
  oneLineCommaListsOr,
  replaceResultTransformer,
  stripIndentTransformer,
  trimResultTransformer,
} from "common-tags";

/**
 * Multiline prompt: tidy indentation, trim edges, and collapse 3+ blank lines.
 * Usage: prompt` ... `
 */
export const prompt = new TemplateTag(
  stripIndentTransformer(),
  trimResultTransformer(),
  // keep output compact: turn runs of 3+ blank lines into just 2
  replaceResultTransformer(/\n{3,}/g, "\n\n"),
);

/**
 * Single-line prompt (e.g., titles, route hints): normalize whitespace.
 * Usage: line` ... `
 */
export const line = new TemplateTag(
  stripIndentTransformer(),
  // collapse line breaks to spaces, then trim
  replaceResultTransformer(/\s*\n\s*/g, " "),
  replaceResultTransformer(/[ \t]+/g, " "),
  trimResultTransformer(),
);

/**
 * Make natural lists from arrays.
 * listAnd(['A','B','C']) -> "A, B and C"
 * listOr(['A','B','C'])  -> "A, B or C"
 * Pass singleLine=true to force one line even if template spans multiple lines.
 */
export function listAnd(items: string[], singleLine = false): string {
  return (singleLine ? oneLineCommaListsAnd : commaListsAnd)`${items}`;
}

export function listOr(items: string[], singleLine = false): string {
  return (singleLine ? oneLineCommaListsOr : commaListsOr)`${items}`;
}

/**
 * Section helper: indent nested content correctly (not HTML-specific).
 * Example: section('CONTEXT', someBlock)
 */
export function section(label: string, body: string): string {
  return prompt`
<${label}>
${html(body)}
</${label}>
`.trim();
}
