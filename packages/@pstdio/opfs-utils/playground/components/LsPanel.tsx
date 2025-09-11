import { useState } from "react";
import { formatLong, formatTree, ls, type LsEntry } from "../../src/utils/opfs-ls";
import { Button, MonoBlock, Row, Section, TextInput } from "./ui";

export function LsPanel({ baseDir, onStatus }: { baseDir: string; onStatus: (s: string) => void }) {
  const [lsDepth, setLsDepth] = useState<number>(Infinity as unknown as number);
  const [lsInclude, setLsInclude] = useState<string>("**/*");
  const [lsExclude, setLsExclude] = useState<string>("**/node_modules/**");
  const [lsShowHidden, setLsShowHidden] = useState<boolean>(true);
  const [lsStat, setLsStat] = useState<boolean>(true);
  const [lsEntries, setLsEntries] = useState<LsEntry[]>([]);

  async function handleList() {
    onStatus("Listing...");

    const include = lsInclude
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const exclude = lsExclude
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const entries = await ls(baseDir, {
      maxDepth: Number.isFinite(lsDepth) ? Number(lsDepth) : Infinity,
      include: include.length ? include : undefined,
      exclude: exclude.length ? exclude : undefined,
      showHidden: lsShowHidden,
      stat: lsStat,
      sortBy: "path",
      sortOrder: "asc",
      dirsFirst: true,
    });

    setLsEntries(entries);
    onStatus(`Listed ${entries.length} entries.`);
  }

  return (
    <Section title="List (ls)">
      <Row>
        <TextInput
          label="Max depth (number or leave empty for ∞)"
          type="number"
          inputMode="numeric"
          value={Number.isFinite(lsDepth) ? String(lsDepth) : ""}
          onChange={(e) => {
            const v = e.currentTarget.value;
            setLsDepth(v === "" ? (Infinity as unknown as number) : Number(v));
          }}
          width={180}
        />

        <TextInput
          label="Include globs (comma-separated)"
          value={lsInclude}
          onChange={(e) => setLsInclude(e.currentTarget.value)}
          width={280}
        />
        <TextInput
          label="Exclude globs (comma-separated)"
          value={lsExclude}
          onChange={(e) => setLsExclude(e.currentTarget.value)}
          width={280}
        />

        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={lsShowHidden} onChange={(e) => setLsShowHidden(e.currentTarget.checked)} />
            Show hidden
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={lsStat} onChange={(e) => setLsStat(e.currentTarget.checked)} />
            Stat files
          </label>
        </div>

        <Button onClick={handleList}>List</Button>
      </Row>

      <div style={{ marginTop: 10 }}>
        {lsEntries.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No entries yet. Click List.</div>
        ) : (
          <>
            <p>List view</p>
            <MonoBlock height={240}>{formatLong(lsEntries)}</MonoBlock>

            <p>Tree view</p>
            <MonoBlock height={240}>{formatTree(lsEntries)}</MonoBlock>
          </>
        )}
      </div>
    </Section>
  );
}
