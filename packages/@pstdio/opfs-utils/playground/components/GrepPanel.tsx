import { useState } from "react";
import { grep } from "../../src/utils/opfs-grep";
import { Button, MonoBlock, Row, Section, TextInput } from "./ui";

export function GrepPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [grepPattern, setGrepPattern] = useState<string>("TODO");
  const [grepFlags, setGrepFlags] = useState<string>("i");
  const [grepInclude, setGrepInclude] = useState<string>("**/*.{ts,tsx,md,txt}");
  const [grepExclude, setGrepExclude] = useState<string>("**/node_modules/**");
  const [grepResults, setGrepResults] = useState<
    Array<{
      file: string;
      line: number;
      column: number;
      match: string;
      lineText: string;
    }>
  >([]);

  async function handleGrep() {
    onStatus("Searching...");

    const include = splitGlobList(grepInclude);
    const exclude = splitGlobList(grepExclude);

    const matches = await grep(baseDir, {
      pattern: grepPattern,
      flags: grepFlags,
      include: include.length ? include : undefined,
      exclude: exclude.length ? exclude : undefined,
    });

    setGrepResults(matches);
    onStatus(`Found ${matches.length} matches.`);
  }

  return (
    <Section title="Search (grep)">
      <Row>
        <TextInput
          label="Pattern"
          value={grepPattern}
          onChange={(e) => setGrepPattern(e.currentTarget.value)}
          width={200}
        />
        <TextInput label="Flags" value={grepFlags} onChange={(e) => setGrepFlags(e.currentTarget.value)} width={90} />
        <TextInput
          label="Include globs"
          value={grepInclude}
          onChange={(e) => setGrepInclude(e.currentTarget.value)}
          width={320}
        />
        <TextInput
          label="Exclude globs"
          value={grepExclude}
          onChange={(e) => setGrepExclude(e.currentTarget.value)}
          width={320}
        />
        <Button onClick={handleGrep}>Search</Button>
      </Row>

      <div style={{ marginTop: 10 }}>
        {grepResults.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No matches.</div>
        ) : (
          <MonoBlock height={260}>
            {grepResults.map((m) => `${m.file}:${m.line}:${m.column} ${m.match} | ${m.lineText}`).join("\n")}
          </MonoBlock>
        )}
      </div>
    </Section>
  );
}

// Split a user-entered list of globs by commas or whitespace,
// but do not split inside brace groups like **/*.{ts,tsx}.
function splitGlobList(input: string): string[] {
  const out: string[] = [];
  let current = "";
  let depth = 0; // brace nesting depth

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    // Support escaping next char
    if (ch === "\\") {
      current += ch;
      if (i + 1 < input.length) {
        current += input[i + 1];
        i++;
      }
      continue;
    }

    if (ch === "{") {
      depth++;
      current += ch;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth--;
      current += ch;
      continue;
    }

    // Outside braces, treat commas and whitespace as separators
    if ((ch === "," || ch === " " || ch === "\t" || ch === "\n") && depth === 0) {
      const token = current.trim();
      if (token) out.push(token);
      current = "";
      continue;
    }

    current += ch;
  }

  const last = current.trim();
  if (last) out.push(last);
  return out;
}
