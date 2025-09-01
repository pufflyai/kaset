import { useState } from "react";
import {
  watchDirectory,
  type ChangeRecord,
  type DirectoryWatcherCleanup,
  type WatchOptions,
} from "../../src/utils/opfs-watch";
import { getDirHandle } from "../opfs-helpers";
import { Button, MonoBlock, Row, Section, TextInput } from "./ui";

export function WatchPanel({
  root,
  baseDir,
  onStatus,
}: {
  root: FileSystemDirectoryHandle | null;
  baseDir: string;
  onStatus: (s: string) => void;
}) {
  const [intervalMs, setIntervalMs] = useState(1500);
  const [pauseWhenHidden, setPauseWhenHidden] = useState(true);
  const [emitInitial, setEmitInitial] = useState(false);
  const [recursive, setRecursive] = useState(true);
  const [ignore, setIgnore] = useState("");
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [stopper, setStopper] = useState<DirectoryWatcherCleanup | null>(null);

  async function handleStart() {
    if (!root) return;
    const dir = await getDirHandle(root, baseDir, true);

    const opts: WatchOptions = {
      intervalMs,
      pauseWhenHidden,
      emitInitial,
      recursive,
    };

    if (ignore.trim()) {
      const regs = ignore
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => new RegExp(s));
      opts.ignore = regs;
    }

    onStatus("Watching...");
    const stop = await watchDirectory(
      dir,
      (cs) => {
        setChanges((prev) => [...prev, ...cs]);
      },
      opts,
    );
    setStopper(() => stop);
  }

  function handleStop() {
    stopper?.();
    setStopper(null);
    onStatus("Stopped watching");
  }

  return (
    <Section title="Watch">
      <Row>
        <TextInput
          label="intervalMs"
          type="number"
          value={String(intervalMs)}
          onChange={(e) => setIntervalMs(Number(e.currentTarget.value))}
          width={100}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={pauseWhenHidden}
            onChange={(e) => setPauseWhenHidden(e.currentTarget.checked)}
          />
          Pause when hidden
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={emitInitial} onChange={(e) => setEmitInitial(e.currentTarget.checked)} />
          Emit initial
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={recursive} onChange={(e) => setRecursive(e.currentTarget.checked)} />
          Recursive
        </label>
        <TextInput
          label="Ignore (regex, comma)"
          value={ignore}
          onChange={(e) => setIgnore(e.currentTarget.value)}
          width={200}
        />
        {stopper ? (
          <Button onClick={handleStop}>Stop</Button>
        ) : (
          <Button onClick={handleStart} disabled={!root}>
            Start
          </Button>
        )}
      </Row>
      {changes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <MonoBlock height={180}>{changes.map((c) => `${c.type} ${c.path.join("/")}`).join("\n")}</MonoBlock>
        </div>
      )}
    </Section>
  );
}
