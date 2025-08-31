import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { GrepPanel } from "./components/GrepPanel";
import { LsPanel } from "./components/LsPanel";
import { PatchPanel } from "./components/PatchPanel";
import { ReadPanel } from "./components/ReadPanel";
import { SetupPanel } from "./components/SetupPanel";
import { Row, TextInput } from "./components/ui";
import { useOPFS } from "./hooks/useOPFS";

const meta: Meta = {
  title: "opfs-utils/Playground",
};

export default meta;

type Story = StoryObj;

function Playground() {
  const { root, error } = useOPFS();
  const [baseDir, setBaseDir] = useState("playground");
  const [status, setStatus] = useState<string>("");

  return (
    <div style={{ fontFamily: "var(--font-body, system-ui, sans-serif)" }}>
      <div style={{ marginBottom: 4, color: "#555" }}>Origin Private File System (OPFS) playground</div>
      <Row>
        <TextInput
          label="Work directory under OPFS"
          value={baseDir}
          onChange={(e) => setBaseDir(e.currentTarget.value)}
          placeholder="e.g. playground"
          width={260}
        />
      </Row>

      <div style={{ marginTop: 8, color: error ? "#991b1b" : "#065f46" }}>
        {error ? `OPFS unavailable: ${error}` : root ? `Using OPFS` : "Preparing OPFS..."}
      </div>

      <div style={{ marginTop: 6, color: "#374151" }}>{status}</div>

      <SetupPanel root={root} baseDir={baseDir} onStatus={setStatus} />
      <LsPanel root={root} baseDir={baseDir} onStatus={setStatus} />
      <ReadPanel root={root} baseDir={baseDir} onStatus={setStatus} />
      <GrepPanel root={root} baseDir={baseDir} onStatus={setStatus} />
      <PatchPanel root={root} baseDir={baseDir} onStatus={setStatus} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Playground />,
};
