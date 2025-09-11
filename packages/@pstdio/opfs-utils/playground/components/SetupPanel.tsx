import { resetDemoProject, setupDemoProject } from "../helpers";
import { Button, Row, Section } from "./ui";

export function SetupPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  async function initSampleFiles() {
    onStatus("Creating sample content...");
    await setupDemoProject(baseDir);
    onStatus("Sample files created.");
  }

  async function resetPlayground() {
    onStatus("Resetting...");
    await resetDemoProject(baseDir);
    onStatus("Playground cleared.");
  }

  return (
    <Section title="Setup demo">
      <Row>
        <Button onClick={initSampleFiles}>Init sample files</Button>
        <Button tone="danger" onClick={resetPlayground}>
          Reset playground
        </Button>
      </Row>
    </Section>
  );
}
