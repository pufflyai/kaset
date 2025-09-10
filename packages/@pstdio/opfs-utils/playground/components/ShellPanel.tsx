import { useState } from "react";
import { runOpfsCommandLine } from "../../src/shell/opfs-shell";
import { Button, Label, MonoBlock, Row, Section, TextInput } from "./ui";

export function ShellPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [cmd, setCmd] = useState(`ls -la`);
  const [out, setOut] = useState("");

  const examples: Array<{ label: string; cmd: string }> = [
    // ls
    { label: "ls -la", cmd: "ls -la" },
    { label: "ls -lR src", cmd: "ls -lR src" },
    { label: "ls -la nested/a/b/c", cmd: "ls -la nested/a/b/c" },
    // rg
    { label: 'rg -n "TODO|examples" docs', cmd: 'rg -n "TODO|examples" docs' },
    { label: 'rg -n -S "readme" .', cmd: 'rg -n -S "readme" .' },
    { label: 'rg -n "function|class" src', cmd: 'rg -n "function|class" src' },
    // sed / echo
    { label: "sed -n '1,40p' docs/PROJECT_README.md", cmd: "sed -n '1,40p' docs/PROJECT_README.md" },
    { label: "ls -la | sed -n '1,20p'", cmd: "ls -la | sed -n '1,20p'" },
    { label: 'echo "alpha beta" | sed -n "1p"', cmd: 'echo "alpha beta" | sed -n "1p"' },
    // nl (number lines)
    { label: "nl -ba docs/PROJECT_README.md", cmd: "nl -ba docs/PROJECT_README.md" },
    {
      label: "sed -n '1,20p' docs/PROJECT_README.md | nl -ba -w 3 -s ': '",
      cmd: "sed -n '1,20p' docs/PROJECT_README.md | nl -ba -w 3 -s ': '",
    },
    // find
    { label: "find . -name '*.md'", cmd: "find . -name '*.md'" },
    { label: "find docs -type f -maxdepth 1", cmd: "find docs -type f -maxdepth 1" },
    // wc
    { label: "wc -l README.md", cmd: "wc -l README.md" },
    { label: 'echo "alpha beta gamma" | wc -w', cmd: 'echo "alpha beta gamma" | wc -w' },
    { label: "wc -l README.md docs/notes.txt", cmd: "wc -l README.md docs/notes.txt" },
  ];

  async function run() {
    onStatus("Running...");
    const res = await runOpfsCommandLine(cmd, {
      cwd: baseDir || "",
      onChunk: (s) => setOut((prev) => prev + s + (s.endsWith("\n") ? "" : "\n")),
    });
    setOut(res.stdout || res.stderr);
    onStatus(res.code === 0 ? "Done." : `Exited with code ${res.code}`);
  }

  return (
    <Section title="Shell (ls | echo | sed | nl | rg | find | wc)">
      <Row>
        <TextInput label="Command(s)" value={cmd} onChange={(e) => setCmd(e.currentTarget.value)} height={120} />
        <Button onClick={run}>Run</Button>
      </Row>
      <div style={{ marginTop: 8 }}>
        <Label>Examples</Label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {examples.map((ex) => (
            <Button key={ex.label} onClick={() => setCmd(ex.cmd)}>
              <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono'" }}>
                {ex.label}
              </code>
            </Button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <MonoBlock height={280}>{out || "Output will appear here."}</MonoBlock>
      </div>
    </Section>
  );
}
