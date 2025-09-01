import { useState } from "react";
import { runOpfsCommandLine } from "../../src/cli/opfs-shell";
import { getDirHandle } from "../opfs-helpers";
import { Button, Label, MonoBlock, Row, Section, TextInput } from "./ui";

export function ShellPanel({
  root,
  baseDir,
  onStatus,
}: {
  root: FileSystemDirectoryHandle | null;
  baseDir: string;
  onStatus: (s: string) => void;
}) {
  const [cmd, setCmd] = useState(`ls -la`);
  const [out, setOut] = useState("");

  const examples: Array<{ label: string; cmd: string }> = [
    { label: "ls -la", cmd: "ls -la" },
    { label: "ls -lR src", cmd: "ls -lR src" },
    { label: "ls -la nested/a/b/c", cmd: "ls -la nested/a/b/c" },
    { label: "rg -n \"TODO|examples\" docs", cmd: 'rg -n "TODO|examples" docs' },
    { label: "rg -n -S \"readme\" .", cmd: 'rg -n -S "readme" .' },
    { label: "sed -n '1,40p' docs/PROJECT_README.md", cmd: "sed -n '1,40p' docs/PROJECT_README.md" },
    { label: "ls -la | sed -n '1,20p'", cmd: "ls -la | sed -n '1,20p'" },
    { label: "rg -n \"function|class\" src", cmd: 'rg -n "function|class" src' },
  ];

  async function run() {
    if (!root) return;
    const work = await getDirHandle(root, baseDir, true);
    onStatus("Running...");
    const res = await runOpfsCommandLine(cmd, {
      root: work,
      cwd: "",
      onChunk: (s) => setOut((prev) => prev + s + (s.endsWith("\n") ? "" : "\n")),
    });
    setOut(res.stdout || res.stderr);
    onStatus(res.code === 0 ? "Done." : `Exited with code ${res.code}`);
  }

  return (
    <Section title="Shell (ls | sed | rg)">
      <Row>
        <TextInput label="Command(s)" value={cmd} onChange={(e) => setCmd(e.currentTarget.value)} height={120} />
        <Button onClick={run} disabled={!root}>
          Run
        </Button>
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
