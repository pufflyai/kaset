import { useRef, useState } from "react";
import { getFs } from "../../src/adapter/fs";
import { Button, MonoBlock, Row, Section, TextArea, TextInput } from "./ui";

export function GetFsPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [path, setPath] = useState(`${baseDir}/zenfs-demo/hello.txt`);
  const [contents, setContents] = useState("Hello from getFs + ZenFS!");
  const [output, setOutput] = useState<string>("");
  const fsRef = useRef<null | (typeof import("@zenfs/core"))["fs"]>(null);

  async function ensureFs() {
    if (fsRef.current) return fsRef.current;

    onStatus("Initializing ZenFS (getFs)...");

    try {
      const fs = await getFs();

      fsRef.current = fs;
      onStatus("ZenFS ready.");

      return fs;
    } catch (e: any) {
      const msg = e?.message || String(e);
      onStatus(`Init failed: ${msg}`);
      throw e;
    }
  }

  function normalize(p: string) {
    return p.startsWith("/") ? p : `/${p}`;
  }

  async function handleWrite() {
    try {
      const fs = await ensureFs();

      onStatus("Writing via ZenFS...");

      const target = normalize(path);
      const dir = target.split("/").slice(0, -1).join("/");
      if (dir) {
        await (fs.promises as any).mkdir?.(dir, { recursive: true });
      }

      await fs.promises.writeFile(target, contents, "utf8" as any);
      onStatus("Write OK.");
    } catch (e: any) {
      onStatus(`Write failed: ${e?.message || e}`);
    }
  }

  async function handleRead() {
    try {
      const fs = await ensureFs();

      onStatus("Reading via ZenFS...");

      const target = normalize(path);
      const text = (await fs.promises.readFile(target, "utf8" as any)) as unknown as string;
      setOutput(text);
      onStatus("Read OK.");
    } catch (e: any) {
      const msg = e?.message || String(e);
      setOutput(msg);
      onStatus("Read failed.");
    }
  }

  return (
    <Section title="getFs (ZenFS) – add/read a file">
      <Row>
        <TextInput
          label="Path (relative to OPFS root)"
          value={path}
          onChange={(e) => setPath(e.currentTarget.value)}
          width={360}
        />
      </Row>

      <Row>
        <Button onClick={handleWrite}>Write via getFs</Button>
        <Button onClick={handleRead}>Read via getFs</Button>
      </Row>

      <div style={{ marginTop: 10 }}>
        <TextArea label="Content (for write)" value={contents} onChange={(e) => setContents(e.currentTarget.value)} />
      </div>

      <div style={{ marginTop: 10 }}>
        <MonoBlock height={160}>{output || "No output yet."}</MonoBlock>
      </div>
    </Section>
  );
}
