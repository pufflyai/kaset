import PACKAGE_README from "../README.md?raw";
import { getFs } from "../src/adapter/fs";
import {
  getDirHandle as migratedGetDirHandle,
  readTextFileOptional as migratedReadTextFileOptional,
  writeTextFile as migratedWriteTextFile,
} from "../src/shared.migrated";
import { SAMPLE_INDEX_TS, SAMPLE_SVG, SAMPLE_TODOS_SATURDAY, SAMPLE_UTIL_TS } from "./samples";

// Compat wrappers over shared.migrated (keep playground API stable)
export async function getDirHandle(path: string, create: boolean): Promise<string> {
  // Returns an absolute POSIX-like path (e.g., "/playground").
  return migratedGetDirHandle(path, create);
}

function joinUnderDir(dir: string, rel: string): string {
  const clean = (s: string) => s.replace(/\\/g, "/").replace(/^\/+/, "");
  const base = clean(dir);
  const child = clean(rel);
  return base ? `${base}/${child}` : child;
}

export async function writeTextFile(dir: string, path: string, content: string) {
  const fullPath = joinUnderDir(dir, path);
  await migratedWriteTextFile(fullPath, content);
}

export async function readTextFile(dir: string, path: string) {
  const fullPath = joinUnderDir(dir, path);
  return await migratedReadTextFileOptional(fullPath);
}

export async function deleteEntry(path: string) {
  const fs = await getFs();

  const normalize = (p: string) => "/" + p.replace(/\\/g, "/").replace(/^\/+/, "").trim();

  const abs = normalize(path);

  async function removeRec(target: string): Promise<void> {
    let st: any;
    try {
      st = await fs.promises.stat(target);
    } catch {
      // Missing; nothing to do.
      return;
    }

    // Files (and non-directories) -> unlink
    if (st.isFile?.() || st.isSymbolicLink?.()) {
      try {
        await fs.promises.unlink(target);
      } catch {
        // ignore
      }
      return;
    }

    // Directory: recurse then remove directory
    if (st.isDirectory?.()) {
      let names: string[] = [];
      try {
        names = await fs.promises.readdir(target);
      } catch {
        names = [];
      }

      for (const name of names) {
        await removeRec(`${target}/${name}`);
      }

      try {
        // rmdir might not exist in some adapters; guard access
        const rmdir = (fs.promises as any).rmdir as undefined | ((p: string) => Promise<void>);
        if (typeof rmdir === "function") await rmdir(target);
      } catch {
        // ignore
      }
    }
  }

  await removeRec(abs);
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

export async function setupDemoProject(baseDir: string, options?: { longReadmeContent?: string }) {
  const dir = await getDirHandle(baseDir, true);

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

export async function resetDemoProject(baseDir: string) {
  await deleteEntry(baseDir);
}
