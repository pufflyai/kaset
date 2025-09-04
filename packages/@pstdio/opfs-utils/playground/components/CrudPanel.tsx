import { useState } from "react";
import {
  readFile as opfsRead,
  writeFile as opfsWrite,
  deleteFile as opfsDelete,
  downloadFile as opfsDownload,
} from "../../src/utils/opfs-crud";
import { Button, MonoBlock, Row, Section, TextArea, TextInput } from "./ui";

export function CrudPanel({ baseDir: _baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  void _baseDir;

  const [path, setPath] = useState("playground/docs/PROJECT_README.md");
  const [contents, setContents] = useState("Hello OPFS!");
  const [output, setOutput] = useState<string>("");

  const fullPath = path; // already relative to OPFS root; include baseDir yourself if desired

  async function handleRead() {
    onStatus("Reading...");

    try {
      const text = await opfsRead(fullPath);
      setOutput(text);
      onStatus("Read OK.");
    } catch (e: any) {
      setOutput(String(e?.message || e));
      onStatus("Read failed.");
    }
  }

  async function handleWrite() {
    onStatus("Writing...");

    try {
      await opfsWrite(fullPath, contents);
      onStatus("Write OK.");
    } catch (e: any) {
      onStatus(`Write failed: ${e?.message || e}`);
    }
  }

  async function handleDelete() {
    onStatus("Deleting...");

    try {
      await opfsDelete(fullPath);
      onStatus("Delete OK.");
    } catch (e: any) {
      onStatus(`Delete failed: ${e?.message || e}`);
    }
  }

  async function handleDownload() {
    onStatus("Downloading...");

    try {
      await opfsDownload(fullPath);
      onStatus("Download triggered.");
    } catch (e: any) {
      onStatus(`Download failed: ${e?.message || e}`);
    }
  }

  return (
    <Section title="CRUD (read/write/delete/download)">
      <Row>
        <TextInput
          label="Path (relative to OPFS root)"
          value={path}
          onChange={(e) => setPath(e.currentTarget.value)}
          width={360}
        />
      </Row>
      <Row>
        <Button onClick={handleRead}>Read</Button>
        <Button onClick={handleWrite}>Write</Button>
        <Button tone="danger" onClick={handleDelete}>
          Delete
        </Button>
        <Button onClick={handleDownload}>Download</Button>
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
