import { createTwoFilesPatch } from "diff";
import { useState } from "react";
import { applyPatchInOPFS as patch } from "../../src/utils/opfs-patch";
import { getDirHandle, readTextFile } from "../opfs-helpers";
import { PATCH_CREATE_FILE, PATCH_MODIFY_INDEX, PATCH_MULTI_FILE, PATCH_MODIFY_INDEX_NO_LINES } from "../samples";
import { Button, MonoBlock, Row, Section, TextArea, TextInput } from "./ui";

export function PatchPanel({
  root,
  baseDir,
  onStatus,
}: {
  root: FileSystemDirectoryHandle | null;
  baseDir: string;
  onStatus: (s: string) => void;
}) {
  const [patchContent, setPatchContent] = useState<string>(PATCH_MODIFY_INDEX);
  const [patchOutput, setPatchOutput] = useState<string>("");
  const [diffPath, setDiffPath] = useState<string>("src/index.ts");
  const [editorContent, setEditorContent] = useState<string>("");
  const [editorOriginal, setEditorOriginal] = useState<string | null>(null);

  async function handlePatch() {
    if (!root) return;
    const dir = await getDirHandle(root, baseDir, true);
    onStatus("Applying patch...");
    const result = await patch({ root: dir, workDir: "", diffContent: patchContent });
    setPatchOutput(result.output);
    onStatus(result.success ? "Patch applied successfully." : "Patch finished with errors.");
  }

  async function loadEditorContent() {
    if (!root) return;
    const path = diffPath.trim().replace(/^\/+/, "");
    if (!path) return;

    const dir = await getDirHandle(root, baseDir, true);

    const current = await readTextFile(dir, path);
    if (current !== null) {
      setEditorContent(current);
      setEditorOriginal(current);
      onStatus(`Loaded current ${path}.`);
      return;
    }

    const baseline = await readTextFile(dir, `.baseline/${path}`);
    setEditorContent(baseline ?? "");
    setEditorOriginal(baseline ?? null);
    onStatus(baseline !== null ? `Loaded baseline ${path}.` : `New file: start typing content for ${path}.`);
  }

  async function generateDiffFromEditor() {
    if (!root) return;
    const path = diffPath.trim().replace(/^\/+/, "");
    if (!path) return;

    const dir = await getDirHandle(root, baseDir, true);
    // Prefer the content that was loaded into the editor as the base.
    // If none was loaded, try the current file, then baseline.
    let base: string | null = editorOriginal;
    if (base === null) {
      const current = await readTextFile(dir, path);
      if (current !== null) base = current;
      else {
        const baseline = await readTextFile(dir, `.baseline/${path}`);
        if (baseline !== null) base = baseline;
      }
    }

    let diff: string;
    if (base === null && editorContent !== "") {
      // New file
      diff = createTwoFilesPatch("/dev/null", `b/${path}`, "", editorContent);
    } else if (base !== null && editorContent === "") {
      // Deletion
      diff = createTwoFilesPatch(`a/${path}`, "/dev/null", base, "");
    } else {
      // Modification relative to the base (what was loaded or current)
      diff = createTwoFilesPatch(`a/${path}`, `b/${path}`, base ?? "", editorContent);
    }

    setPatchContent(diff);
    onStatus(
      `Generated diff from editor relative to ${base === editorOriginal ? "loaded content" : "current/baseline"} for ${path}.`,
    );
  }

  return (
    <Section title="Patch (unified diff)">
      <Row>
        <Button onClick={() => setPatchContent(PATCH_MODIFY_INDEX)}>Insert sample modify diff</Button>
        <Button onClick={() => setPatchContent(PATCH_CREATE_FILE)}>Insert sample create diff</Button>
        <Button onClick={() => setPatchContent(PATCH_MULTI_FILE)}>Insert sample multi-file diff</Button>
        <Button onClick={() => setPatchContent(PATCH_MODIFY_INDEX_NO_LINES)}>Insert sample no-line-number diff</Button>
        <Button onClick={handlePatch} disabled={!root}>
          Apply patch
        </Button>
      </Row>

      <div style={{ marginTop: 10 }}>
        <Row>
          <TextInput
            label="git diff -- path/to/file"
            value={diffPath}
            onChange={(e) => setDiffPath(e.currentTarget.value)}
            placeholder="e.g. src/index.ts"
            width={280}
          />
          <Button onClick={loadEditorContent} disabled={!root}>
            Load file
          </Button>
          <Button onClick={generateDiffFromEditor} disabled={!root}>
            Generate
          </Button>
        </Row>
      </div>

      <div style={{ marginTop: 10 }}>
        <TextArea
          label="File content (edit)"
          value={editorContent}
          onChange={(e) => setEditorContent(e.currentTarget.value)}
          height={180}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <TextArea
          label="Diff content"
          value={patchContent}
          onChange={(e) => setPatchContent(e.currentTarget.value)}
          height={180}
        />
      </div>

      {patchOutput ? (
        <div style={{ marginTop: 10 }}>
          <MonoBlock height={120}>{patchOutput}</MonoBlock>
        </div>
      ) : null}
    </Section>
  );
}
