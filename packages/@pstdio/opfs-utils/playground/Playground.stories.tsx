import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { CrudPanel } from "./components/CrudPanel";
import { GrepPanel } from "./components/GrepPanel";
import { LsPanel } from "./components/LsPanel";
import { GetFsPanel } from "./components/GetFsPanel";
import { PatchPanel } from "./components/PatchPanel";
import { ReadPanel } from "./components/ReadPanel";
import { SetupPanel } from "./components/SetupPanel";
import { ShellPanel } from "./components/ShellPanel";
import { UploadPanel } from "./components/UploadPanel";
import { WatchPanel } from "./components/WatchPanel";
import { GitPanel } from "./components/GitPanel";
import { Row, TextInput } from "./components/ui";
import { getFs } from "../src/adapter/fs";

const meta: Meta = {
  title: "opfs-utils/Playground",
};

export default meta;

type Story = StoryObj;

function Playground() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseDir, setBaseDir] = useState("playground");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await getFs();
        if (!mounted) return;
        setReady(true);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

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
        {error ? `OPFS unavailable: ${error}` : ready ? `Using OPFS via ZenFS adapter` : "Preparing adapter..."}
      </div>

      <div style={{ marginTop: 6, color: "#374151" }}>{status}</div>

      <SetupPanel baseDir={baseDir} onStatus={setStatus} />
      <GetFsPanel baseDir={baseDir} onStatus={setStatus} />
      <LsPanel baseDir={baseDir} onStatus={setStatus} />
      <ReadPanel baseDir={baseDir} onStatus={setStatus} />
      <GrepPanel baseDir={baseDir} onStatus={setStatus} />
      <PatchPanel baseDir={baseDir} onStatus={setStatus} />
      <UploadPanel baseDir={baseDir} onStatus={setStatus} />
      <WatchPanel baseDir={baseDir} onStatus={setStatus} />
      <ShellPanel baseDir={baseDir} onStatus={setStatus} />
      <CrudPanel baseDir={baseDir} onStatus={setStatus} />
      <GitPanel baseDir={baseDir} onStatus={setStatus} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Playground />,
};
