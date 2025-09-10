import { useState } from "react";
import {
  pickAndUploadFilesToDirectory,
  uploadFilesToDirectory,
  type FileUploadBaseOptions,
  type FileUploadResult,
} from "../../src/utils/opfs-upload";
import { getDirHandle } from "../helpers";
import { Button, MonoBlock, Row, Section, TextInput } from "./ui";

export function UploadPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [destSubdir, setDestSubdir] = useState("");
  const [overwrite, setOverwrite] = useState<FileUploadBaseOptions["overwrite"]>("replace");
  const [accept, setAccept] = useState(".csv,.json,.txt,.xlsx,.parquet");
  const [multiple, setMultiple] = useState(true);
  const [result, setResult] = useState<FileUploadResult | null>(null);

  async function getDestRoot() {
    return await getDirHandle(baseDir, true);
  }

  async function handlePick() {
    const dir = await getDestRoot();
    onStatus("Picking...");
    try {
      const res = await pickAndUploadFilesToDirectory(dir, {
        destSubdir,
        overwrite,
        accept,
        multiple,
      });
      setResult(res);
      onStatus(`Uploaded ${res.uploadedFiles.length} files`);
    } catch (e) {
      onStatus((e as Error).message);
    }
  }

  async function handleProgrammatic() {
    const dir = await getDestRoot();
    onStatus("Uploading...");
    const f = new File(["demo"], "demo.txt", { type: "text/plain" });
    const res = await uploadFilesToDirectory(dir, [f], { destSubdir, overwrite });
    setResult(res);
    onStatus(`Uploaded ${res.uploadedFiles.length} files`);
  }

  return (
    <Section title="Upload">
      <Row>
        <TextInput
          label="Destination subdir"
          value={destSubdir}
          onChange={(e) => setDestSubdir(e.currentTarget.value)}
          width={200}
        />
        <div>
          <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 6 }}>Overwrite</label>
          <select
            value={overwrite}
            onChange={(e) => setOverwrite(e.currentTarget.value as any)}
            style={{
              padding: "6px 8px",
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
          >
            <option value="replace">replace</option>
            <option value="skip">skip</option>
            <option value="rename">rename</option>
          </select>
        </div>
        <TextInput label="Accept" value={accept} onChange={(e) => setAccept(e.currentTarget.value)} width={160} />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.currentTarget.checked)} />
          Multiple
        </label>
        <Button onClick={handlePick}>Pick & Upload</Button>
        <Button onClick={handleProgrammatic}>Upload (demo)</Button>
      </Row>
      {result && (
        <div style={{ marginTop: 8 }}>
          <p>Uploaded files</p>
          <MonoBlock height={120}>{result.uploadedFiles.concat(result.errors).join("\n")}</MonoBlock>
        </div>
      )}
    </Section>
  );
}
