import type { Meta, StoryObj } from "@storybook/react";
import { createTwoFilesPatch } from "diff";
import { useCallback, useEffect, useMemo, useState } from "react";
import { scan, setOptions } from "react-scan";
import type { ApplyPatchOptions, FileOperationResult } from "../src/git/patch";
import { applyPatchInOPFS } from "../src/git/patch";
import { getFs } from "../src/adapter/fs";
import { getDirHandle, readTextFile, resetDemoProject, setupDemoProject } from "./helpers";
import { PATCH_MODIFY_INDEX, PATCH_MULTI_FILE } from "./samples";
import { Button, MonoBlock, Row, Section, TextInput } from "./components/ui";

interface BenchmarkScenario {
  id: string;
  label: string;
  description: string;
  iterations: number;
  buildSetupOptions?: (
    context: ScenarioIterationContext,
  ) => Promise<Parameters<typeof setupDemoProject>[1] | undefined>;
  createDiff: (context: ScenarioIterationContext) => Promise<string>;
  applyOptions?: (context: ScenarioIterationContext) => Promise<Partial<ApplyPatchOptions>>;
}

interface ScenarioIterationContext {
  baseDir: string;
  iteration: number;
  scenario: BenchmarkScenario;
}

interface IterationResult {
  iteration: number;
  durationMs: number | null;
  diff: string;
  output: string;
  success: boolean;
  details?: FileOperationResult["details"];
  error?: string;
}

interface ScenarioRunResult {
  scenario: BenchmarkScenario;
  iterations: IterationResult[];
  averageMs: number | null;
  minMs: number | null;
  maxMs: number | null;
  diffLines: number;
  diffBytes: number;
  successes: number;
  failures: number;
}

const meta: Meta = {
  title: "opfs-utils/Patch Performance",
};

export default meta;

type Story = StoryObj;

declare global {
  interface Window {
    __opfsBenchmarkScanInitialized?: boolean;
  }
}

const SYNTHETIC_PARAGRAPH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. " +
  "Duis cursus, mi quis viverra ornare, eros dolor interdum nulla, ut commodo diam libero vitae erat. " +
  "Aenean faucibus nibh et justo cursus id rutrum lorem imperdiet. Nunc ut sem vitae risus tristique posuere.";

function buildSyntheticReadme(sectionCount: number): string {
  const parts: string[] = [
    "# Synthetic Project Documentation",
    "",
    "This README is generated to exercise OPFS patch performance.",
    "",
    "Contents:",
    "- Overview",
    "- Usage",
    "- Benchmarks",
    "- Changelog",
    "- License",
    "",
  ];

  for (let i = 1; i <= sectionCount; i++) {
    parts.push(`## Section ${i}`);
    parts.push("");
    parts.push(SYNTHETIC_PARAGRAPH);
    parts.push("");
    parts.push(SYNTHETIC_PARAGRAPH);
    parts.push("");
  }

  parts.push("## Appendix");
  parts.push("");
  parts.push("Additional material for benchmarking scenarios.");
  parts.push("");

  return parts.join("\n");
}

const SYNTHETIC_README = buildSyntheticReadme(220);

const SCENARIOS: BenchmarkScenario[] = [
  {
    id: "small-modify",
    label: "Modify a small TypeScript module",
    description: "Applies a short diff that tweaks a handful of lines inside src/index.ts.",
    iterations: 6,
    createDiff: async () => PATCH_MODIFY_INDEX,
  },
  {
    id: "multi-file",
    label: "Apply a multi-file change set",
    description:
      "Exercises mixed operations (modify, create, delete) across several files using the sample multi-file diff.",
    iterations: 4,
    createDiff: async () => PATCH_MULTI_FILE,
  },
  {
    id: "rename-only",
    label: "Rename util.ts without content changes",
    description: "Validates rename handling with a hunk that only contains context lines (no textual edits).",
    iterations: 4,
    createDiff: async () => {
      const contextLines = [
        " export const add = (a: number, b: number) => a + b;",
        ' export const todo = "TODO: replace this";',
      ];
      return ["--- a/src/util.ts", "+++ b/src/helpers.ts", "@@", ...contextLines, ""].join("\n");
    },
  },
  {
    id: "large-markdown",
    label: "Rewrite multiple chunks in a large README",
    description:
      "Generates a diff that touches distant sections inside a synthetic ~220 section markdown file to stress fuzzy placement.",
    iterations: 3,
    buildSetupOptions: async () => ({ longReadmeContent: SYNTHETIC_README }),
    createDiff: async ({ baseDir, iteration }) => {
      const dir = await getDirHandle(baseDir, true);
      const baseline = await readTextFile(dir, ".baseline/docs/PROJECT_README.md");
      if (baseline === null) {
        throw new Error("Baseline README not found. Did setupDemoProject run?");
      }

      const sectionsToAugment = new Set<number>([5, 60, 120, 180, 220]);
      const lines = baseline.split("\n");
      const mutated: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        mutated.push(line);
        if (line.startsWith("## Section ")) {
          const num = parseInt(line.slice("## Section ".length), 10);
          if (Number.isFinite(num) && sectionsToAugment.has(num)) {
            mutated.push("");
            mutated.push(`> Benchmark iteration ${iteration}: updated guidance.`);
            mutated.push("");
          }
        }
      }

      mutated.push("## Benchmark Summary");
      mutated.push("");
      mutated.push(`- Scenario iteration ${iteration} completed.`);
      mutated.push(`- Generated at ${new Date().toISOString()}.`);
      mutated.push("");

      return createTwoFilesPatch("a/docs/PROJECT_README.md", "b/docs/PROJECT_README.md", baseline, mutated.join("\n"));
    },
  },
];

function formatMs(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "–";
  if (value < 1) return `${value.toFixed(3)} ms`;
  return `${value.toFixed(2)} ms`;
}

function summarizeDetails(details?: FileOperationResult["details"]): string {
  if (!details) return "";
  const parts: string[] = [];
  if (details.created?.length) parts.push(`created ${details.created.length}`);
  if (details.modified?.length) parts.push(`modified ${details.modified.length}`);
  if (details.deleted?.length) parts.push(`deleted ${details.deleted.length}`);
  if (details.renamed?.length) parts.push(`renamed ${details.renamed.length}`);
  if (details.failed?.length) parts.push(`failed ${details.failed.length}`);
  return parts.join(", ");
}

function PatchPerformanceStory() {
  const [ready, setReady] = useState(false);
  const [adapterError, setAdapterError] = useState<string | null>(null);
  const [baseDir, setBaseDir] = useState("perf-bench");
  const [status, setStatus] = useState<string>("Idle");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ScenarioRunResult[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const options = {
      allowInIframe: true,
      enabled: true,
      showFPS: true,
      showToolbar: true,
    };

    if (!window.__opfsBenchmarkScanInitialized) {
      window.__opfsBenchmarkScanInitialized = true;
      scan(options);
      return;
    }

    setOptions(options);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await getFs();
        if (mounted) {
          setReady(true);
        }
      } catch (error: any) {
        if (mounted) {
          setAdapterError(error?.message || String(error));
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const runBenchmarks = useCallback(async () => {
    if (running) return;
    const trimmed = baseDir.trim() || "perf-bench";
    const workDir = trimmed.replace(/^\/+/, "");

    setRunning(true);
    setStatus("Preparing benchmark workspace...");
    setResults([]);

    try {
      await resetDemoProject(workDir).catch(() => undefined);

      const scenarioResults: ScenarioRunResult[] = [];

      for (const scenario of SCENARIOS) {
        const iterationResults: IterationResult[] = [];
        setStatus(`Running scenario: ${scenario.label}`);

        for (let iteration = 1; iteration <= scenario.iterations; iteration++) {
          const context: ScenarioIterationContext = { baseDir: workDir, iteration, scenario };
          setStatus(`Running scenario: ${scenario.label} (iteration ${iteration}/${scenario.iterations})`);

          let diff = "";

          try {
            const setupOptions = scenario.buildSetupOptions ? await scenario.buildSetupOptions(context) : undefined;
            await setupDemoProject(workDir, setupOptions);

            diff = await scenario.createDiff(context);
            const applyOpts = scenario.applyOptions ? await scenario.applyOptions(context) : {};
            const start = performance.now();
            const result = await applyPatchInOPFS({
              workDir,
              diffContent: diff,
              ...applyOpts,
            });
            const duration = performance.now() - start;
            iterationResults.push({
              iteration,
              durationMs: duration,
              diff,
              output: result.output,
              success: result.success,
              details: result.details,
            });
          } catch (error: any) {
            const message = error?.message || String(error);
            iterationResults.push({
              iteration,
              durationMs: null,
              diff,
              output: message,
              success: false,
              error: message,
            });
          } finally {
            await resetDemoProject(workDir).catch(() => undefined);
          }
        }

        const successfulDurations = iterationResults
          .filter((r) => r.success && typeof r.durationMs === "number")
          .map((r) => r.durationMs ?? 0);
        const averageMs = successfulDurations.length
          ? successfulDurations.reduce((sum, value) => sum + value, 0) / successfulDurations.length
          : null;
        const minMs = successfulDurations.length ? Math.min(...successfulDurations) : null;
        const maxMs = successfulDurations.length ? Math.max(...successfulDurations) : null;
        const referenceDiff = iterationResults.find((r) => r.diff);
        const diffLines = referenceDiff ? referenceDiff.diff.split(/\r?\n/).length : 0;
        const diffBytes = referenceDiff ? referenceDiff.diff.length : 0;
        const successes = iterationResults.filter((r) => r.success).length;
        const failures = iterationResults.length - successes;

        scenarioResults.push({
          scenario,
          iterations: iterationResults,
          averageMs,
          minMs,
          maxMs,
          diffLines,
          diffBytes,
          successes,
          failures,
        });
      }

      setResults(scenarioResults);
      setStatus("Benchmark run complete.");
    } catch (error: any) {
      const message = error?.message || String(error);
      setStatus(`Benchmark run failed: ${message}`);
    } finally {
      setRunning(false);
    }
  }, [baseDir, running]);

  const statusColor = useMemo(() => {
    if (adapterError) return "#991b1b";
    if (running) return "#065f46";
    return "#374151";
  }, [adapterError, running]);

  return (
    <div style={{ fontFamily: "var(--font-body, system-ui, sans-serif)", maxWidth: 960 }}>
      <Section title="OPFS patch performance benchmarks" defaultOpen>
        <p style={{ marginTop: 0, marginBottom: 12, color: "#4b5563", lineHeight: 1.5 }}>
          Run a curated set of scenarios that stress the <code>patch</code> helper. Each iteration resets the workspace,
          seeds demo content, and measures how long <code>applyPatchInOPFS</code> takes to complete. Use this panel to
          observe the relative cost of small edits, mixed multi-file diffs, rename-only operations, and large fuzzy
          matches.
        </p>
        <Row>
          <TextInput
            label="Benchmark workspace under OPFS"
            value={baseDir}
            onChange={(event) => setBaseDir(event.currentTarget.value)}
            placeholder="e.g. perf-bench"
            width={240}
          />
          <Button onClick={runBenchmarks} disabled={!ready || !!adapterError || running}>
            {running ? "Running..." : "Run benchmarks"}
          </Button>
        </Row>
        <div style={{ marginTop: 8, color: statusColor }}>{adapterError ? adapterError : status}</div>
        {!ready && !adapterError ? (
          <div style={{ marginTop: 12, color: "#b45309" }}>Initializing OPFS adapter...</div>
        ) : null}
      </Section>

      {results.map((result) => {
        const { scenario } = result;
        return (
          <Section key={scenario.id} title={scenario.label} defaultOpen>
            <p style={{ marginTop: 0, marginBottom: 12, color: "#4b5563", lineHeight: 1.5 }}>{scenario.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <MetricCard label="Iterations" value={String(result.iterations.length)} />
              <MetricCard label="Successes" value={String(result.successes)} />
              <MetricCard
                label="Failures"
                value={String(result.failures)}
                tone={result.failures ? "danger" : "default"}
              />
              <MetricCard label="Average" value={formatMs(result.averageMs)} />
              <MetricCard label="Fastest" value={formatMs(result.minMs)} />
              <MetricCard label="Slowest" value={formatMs(result.maxMs)} />
              <MetricCard label="Diff lines" value={String(result.diffLines)} />
              <MetricCard label="Diff size" value={`${result.diffBytes} bytes`} />
            </div>

            <div style={{ marginTop: 16 }}>
              <MonoBlock height={220}>
                {result.iterations.map((iteration) => {
                  const summary = summarizeDetails(iteration.details);
                  const prefix = iteration.success ? "✅" : "❌";
                  const durationText = iteration.durationMs !== null ? formatMs(iteration.durationMs) : "–";
                  const description = summary ? `${iteration.output} (${summary})` : iteration.output;
                  const message = iteration.error ? `${iteration.output}` : description;
                  return (
                    <div key={iteration.iteration} style={{ marginBottom: 8 }}>
                      <div>
                        {prefix} Iteration {iteration.iteration}: {durationText}
                      </div>
                      <div style={{ color: "#9ca3af" }}>{message}</div>
                    </div>
                  );
                })}
              </MonoBlock>
            </div>
          </Section>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  const palette =
    tone === "danger"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#b91c1c" }
      : { bg: "#eef2ff", border: "#c7d2fe", text: "#3730a3" };

  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.text,
        borderRadius: 8,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

export const Benchmark: Story = {
  render: () => <PatchPerformanceStory />,
};
