import { useState } from "react";
import { runOpfsCommandLine } from "../../src/cli/opfs-shell";
import { getDirHandle } from "../opfs-helpers";
import { Button, MonoBlock, Row, Section, TextArea } from "./ui";

export function ShellPanel({
  root,
  baseDir,
  onStatus,
}: {
  root: FileSystemDirectoryHandle | null;
  baseDir: string;
  onStatus: (s: string) => void;
}) {
  const [cmd, setCmd] = useState(
    `ls -la .github/workflows && sed -n '1,220p' .github/workflows/documentation.yml\nrg -n "npm ci|include=dev|omit=dev|NODE_ENV|prepare" .github/workflows -S`,
  );
  const [out, setOut] = useState("");

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
        <TextArea label="Command(s)" value={cmd} onChange={(e) => setCmd(e.currentTarget.value)} height={120} />
        <Button onClick={run} disabled={!root}>
          Run
        </Button>
      </Row>
      <div style={{ marginTop: 10 }}>
        <MonoBlock height={280}>{out || "Output will appear here."}</MonoBlock>
      </div>
    </Section>
  );
}
