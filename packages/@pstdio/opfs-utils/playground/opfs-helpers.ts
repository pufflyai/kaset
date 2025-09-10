import PACKAGE_README from "../README.md?raw";
import { SAMPLE_INDEX_TS, SAMPLE_SVG, SAMPLE_TODOS_SATURDAY, SAMPLE_UTIL_TS } from "./samples";
import { basename, parentOf } from "../src/utils/path";
import {
  getDirHandle as sharedGetDirHandle,
  writeTextFile as sharedWriteTextFile,
  readTextFileOptional,
} from "../src/shared";

// Re-export shared helpers for playground consumers
export const getDirHandle = sharedGetDirHandle;
export const writeTextFile = sharedWriteTextFile;

export async function readTextFile(root: FileSystemDirectoryHandle, path: string) {
  return await readTextFileOptional(root, path);
}

export async function deleteEntry(root: FileSystemDirectoryHandle, path: string) {
  const dir = await sharedGetDirHandle(root, parentOf(path), false).catch(
    () => null as unknown as FileSystemDirectoryHandle,
  );
  if (!dir) return;
  try {
    await dir.removeEntry(basename(path), { recursive: true } as any);
  } catch {
    // ignore
  }
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

  // Todos sample used by the multi-line non-consecutive patch demo
  await writeTextFile(dir, "todos/saturday.md", SAMPLE_TODOS_SATURDAY);
  await writeTextFile(dir, ".baseline/todos/saturday.md", SAMPLE_TODOS_SATURDAY);

  // Deeply nested example for glob/list tests
  await writeTextFile(dir, "nested/a/b/c/deep.txt", "This is a deeply nested file.\n");
  await writeTextFile(dir, ".baseline/nested/a/b/c/deep.txt", "This is a deeply nested file.\n");
}

export async function resetDemoProject(root: FileSystemDirectoryHandle, baseDir: string) {
  await deleteEntry(root, baseDir);
}
