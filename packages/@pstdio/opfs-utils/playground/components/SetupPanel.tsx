import { resetDemoProject, setupDemoProject } from "../opfs-helpers";
import { Button, Row, Section } from "./ui";

export function SetupPanel({
  root,
  baseDir,
  onStatus,
}: {
  root: FileSystemDirectoryHandle | null;
  baseDir: string;
  onStatus: (s: string) => void;
}) {
  async function initSampleFiles() {
    if (!root) return;
    onStatus("Creating sample content...");
    await setupDemoProject(root, baseDir);
    onStatus("Sample files created.");
  }

  async function resetPlayground() {
    if (!root) return;
    onStatus("Resetting...");
    await resetDemoProject(root, baseDir);
    onStatus("Playground cleared.");
  }

  return (
    <Section title="Setup demo">
      <Row>
        <Button onClick={initSampleFiles} disabled={!root}>
          Init sample files
        </Button>
        <Button tone="danger" onClick={resetPlayground} disabled={!root}>
          Reset playground
        </Button>
      </Row>
    </Section>
  );
}
