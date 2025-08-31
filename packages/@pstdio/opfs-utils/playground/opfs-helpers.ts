import PACKAGE_README from "../README.md?raw";
import { SAMPLE_INDEX_TS, SAMPLE_SVG, SAMPLE_UTIL_TS } from "./samples";

export async function getDirHandle(root: FileSystemDirectoryHandle, path: string, create: boolean) {
  const segs = path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  let cur = root;
  for (const s of segs) {
    cur = await cur.getDirectoryHandle(s, { create });
  }
  return cur;
}

export async function writeTextFile(root: FileSystemDirectoryHandle, path: string, content: string) {
  const dir = await getDirHandle(root, parentOf(path), true);
  const fh = await dir.getFileHandle(basename(path), { create: true });
  const w = await fh.createWritable();
  await w.write(new Blob([content], { type: "text/plain" }));
  await w.close();
}

export async function readTextFile(root: FileSystemDirectoryHandle, path: string) {
  try {
    const dir = await getDirHandle(root, parentOf(path), false);
    const fh = await dir.getFileHandle(basename(path), { create: false });
    const f = await fh.getFile();
    return await f.text();
  } catch {
    return null;
  }
}

export async function deleteEntry(root: FileSystemDirectoryHandle, path: string) {
  const dir = await getDirHandle(root, parentOf(path), false).catch(() => null);
  if (!dir) return;
  try {
    await dir.removeEntry(basename(path), { recursive: true } as any);
  } catch {
    // ignore
  }
}

export function parentOf(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? "" : p.slice(0, i);
}

export function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i === -1 ? p : p.slice(i + 1);
}

// Build a long README-like markdown content for testing large file handling
function buildLongReadme(): string {
  const header =
    "# Core Utils – Long Sample README\n\n" +
    "This file is intentionally long to test OPFS operations (write/read/list/glob).\n\n" +
    "Contents:\n- Overview\n- Usage\n- Benchmarks\n- Changelog\n- License\n\n";
  const paragraph =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros elementum tristique. " +
    "Duis cursus, mi quis viverra ornare, eros dolor interdum nulla, ut commodo diam libero vitae erat. " +
    "Aenean faucibus nibh et justo cursus id rutrum lorem imperdiet. Nunc ut sem vitae risus tristique posuere.\n\n";
  let body = "";
  for (let i = 1; i <= 300; i++) {
    body += `## Section ${i}\n\n${paragraph}${paragraph}`;
  }
  return header + body;
}

// Demo project scaffolding for the OPFS playground

export async function setupDemoProject(
  root: FileSystemDirectoryHandle,
  baseDir: string,
  options?: { longReadmeContent?: string },
) {
  const dir = await getDirHandle(root, baseDir, true);

  await writeTextFile(dir, "README.md", "# Playground\n\nThis is a test area for opfs-utils.\n");
  await writeTextFile(dir, ".baseline/README.md", "# Playground\n\nThis is a test area for opfs-utils.\n");

  await writeTextFile(dir, "docs/notes.txt", "Notes about the project.\nTODO: add more examples.\n");
  await writeTextFile(dir, ".baseline/docs/notes.txt", "Notes about the project.\nTODO: add more examples.\n");

  // Long sample file: prefer the package README, allow override, fallback to generated
  const longReadme =
    options?.longReadmeContent ??
    (typeof PACKAGE_README === "string" && PACKAGE_README.length > 0 ? PACKAGE_README : buildLongReadme());
  await writeTextFile(dir, "docs/PROJECT_README.md", longReadme);
  await writeTextFile(dir, ".baseline/docs/PROJECT_README.md", longReadme);

  await writeTextFile(dir, "src/index.ts", SAMPLE_INDEX_TS);
  await writeTextFile(dir, "src/util.ts", SAMPLE_UTIL_TS);
  await writeTextFile(dir, ".baseline/src/index.ts", SAMPLE_INDEX_TS);
  await writeTextFile(dir, ".baseline/src/util.ts", SAMPLE_UTIL_TS);

  await writeTextFile(dir, "assets/logo.svg", SAMPLE_SVG);
  await writeTextFile(dir, ".hidden/secret.txt", "Hidden secrets live here.\n");
  await writeTextFile(dir, ".baseline/assets/logo.svg", SAMPLE_SVG);
  await writeTextFile(dir, ".baseline/.hidden/secret.txt", "Hidden secrets live here.\n");

  // Deeply nested example for glob/list tests
  await writeTextFile(dir, "nested/a/b/c/deep.txt", "This is a deeply nested file.\n");
  await writeTextFile(dir, ".baseline/nested/a/b/c/deep.txt", "This is a deeply nested file.\n");
}

export async function resetDemoProject(root: FileSystemDirectoryHandle, baseDir: string) {
  await deleteEntry(root, baseDir);
}
