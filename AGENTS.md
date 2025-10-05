# Kaset – Agent Instructions

Guidance for working in this TypeScript monorepo. This repo provides browser‑first utilities under the `@pstdio` scope: OPFS helpers, OPFS↔remote sync, prompt utilities, and a folder‑to‑markdown descriptor.

Key technologies: Node.js 22 (required), npm workspaces, Lerna, TypeScript, Vite, Vitest, Storybook (for `opfs-utils`).

## Build & Validation

CRITICAL: Use npm (not yarn/pnpm). Node.js 22 is required.

Essential commands (from repo root):

1. Lint: `npm run lint`
2. Build: `npm run build`
3. Test: `npm run test`

Validation sequence (matches CI intent):

```bash
npm run format:check
npm run lint
npx lerna run build
npx lerna run test
```

Utilities:

- Format: `npm run format`
- Clean: `npm run clean`
- End‑to‑end reset: `npm run reset:all`

## Monorepo structure

```
packages/@pstdio/
  opfs-utils/      # OPFS helpers (ls/grep/read/patch)
  opfs-hooks/      # React hooks for OPFS (uses opfs-utils)
  opfs-sync/       # OPFS <-> remote sync (Supabase remote included)
  prompt-utils/    # Prompt & JSON utilities
  tiny-ai-tasks/   # AI workflows and tool-using agents (LLM + tools)
  tiny-tasks/      # Composable, interrupt-friendly workflows (pause/resume)
  describe-context/# Analyze a folder and emit markdown context (library + CLI)
clients/
  documentation/   # VitePress docs site
```

Import rules:

- ✅ `import { foo } from "@pstdio/<package>"`
- ❌ No deep relative imports across packages (e.g., `../../..` between packages)
- Packages must not import from `clients/*`
- Imports must always be placed at the top of the file

Key configuration:

- Root: `package.json` (workspaces/scripts), `lerna.json`, `nx.json` (cache)
- Per‑package: `tsconfig.json`, `vite.config.ts`, optional `vitest.config.ts`

## Packages

### @pstdio/opfs-utils

OPFS utilities targeting modern browsers.

- Notable APIs: `ls(...)`, `grep(...)`, `processSingleFileContent(...)`, `patch(...)`
- Storybook available for dev/visual checks
- Scripts: `build`, `test`, `storybook`, `test-storybook`

Run (from root):

```bash
npm run build --workspace @pstdio/opfs-utils
npm run test --workspace @pstdio/opfs-utils
```

### @pstdio/opfs-hooks

React hooks for working with the browser's OPFS.

- Depends on `@pstdio/opfs-utils` for core operations
- Scripts: `build`, `test`

Run (from root):

```bash
npm run build --workspace @pstdio/opfs-hooks
npm run test --workspace @pstdio/opfs-hooks
```

### @pstdio/opfs-sync

Two‑way synchronization between an OPFS directory and a remote provider.

- Core class: `OpfsSync`
- Remote: `SupabaseRemote` (Supabase Storage)
- Scripts: `build`, `test`, `test:ui`, `test:coverage`

Run (from root):

```bash
npm run build --workspace @pstdio/opfs-sync
npm run test --workspace @pstdio/opfs-sync
```

### @pstdio/prompt-utils

Prompt and JSON helpers for LLM workflows.

- APIs: `prompt`, `getSchema`, `parseJSONStream`, `safeStringify`, `safeParse`, `shortUID`, `hashString`
- Scripts: `build`, `test`

Run (from root):

```bash
npm run build --workspace @pstdio/prompt-utils
npm run test --workspace @pstdio/prompt-utils
```

### @pstdio/tiny-ai-tasks

AI workflows and tool-using agents for building streaming LLM tasks, minimal agents, and history summarization/truncation.

- APIs: `createLLMTask`, `createAgent`, `Tool`, `createToolTask`, `toOpenAITools`, `truncateToBudget`, `createSummarizer`
- Scripts: `build`, `test`

Run (from root):

```bash
npm run build --workspace @pstdio/tiny-ai-tasks
npm run test  --workspace @pstdio/tiny-ai-tasks
```

### @pstdio/tiny-tasks

Composable, interrupt-friendly workflows for TypeScript/JavaScript. Turn async functions into checkpoint-able generators that can pause, persist, and resume.

- APIs: `task`, `createRuntime`, `MemorySaver`
- Scripts: `build`, `test`

Run (from root):

```bash
npm run build --workspace @pstdio/tiny-tasks
npm run test --workspace @pstdio/tiny-tasks
```

### describe-context

Analyze a folder and produce an LLM‑friendly markdown context (directory tree + selected file content).

- Library: `generateContext(path)`
- CLI (after building): `node packages/@pstdio/describe-context/dist/generate-context.js <folder> [output-file]`
- Scripts: `build`

Run (from root):

```bash
npm run build --workspace describe-context
```

## Docs site

`clients/documentation` uses VitePress.

```bash
npm run start --workspace documentation
npm run build --workspace documentation
```

## Development workflow

1. Format → Lint → Build → Test before PRs.
2. Use `npx lerna run <script>` for cross‑package tasks when needed.
3. Nx caching is enabled for builds (`nx.json`).
4. Tests use Vitest; avoid introducing other frameworks.

Import notes:

- Prefer `@pstdio/<package>` imports where applicable. The `describe-context` package is currently unscoped in its `package.json` and uses the workspace name `describe-context`.

### Quick reference

- Validate: `npm run format:check && npm run lint && npm run build && npm run test`
- Single package build: `npm run build --workspace <name>`
- Single package test: `npm run test --workspace <name>`

---

## Code Style Guide

## 1. Avoid Code Clumping

- Don’t stack multiple operations together without whitespace.
- Clumped code makes it harder to visually parse what’s happening.

## 2. Use Whitespace to Communicate Intent

- Insert blank lines between logical sections of code.
- Each section should represent a distinct step:
  - variable declarations
  - async operations (file I/O, network calls)
  - parsing/transformation
  - return statements

## 3. Group Related Statements, Separate Unrelated Ones

- Keep closely related lines together.
- Add a blank line before/after a shift in purpose.

## 4. Prioritize Readability Over Compactness

- Prefer clear, spaced code over dense, hard‑to‑scan blocks.

## 5. Consistency Matters

- Apply spacing consistently; aim for a rhythm of setup → work → finish.

---

✅ Example (good):

```ts
if (!user || items.length === 0) return;

const dir = getUserDir(user);
const path = getUserFilePath(user);

await fs.mkdirp(dir);

const current = await readFile(path);
const parsed = current ? JSON.parse(current) : { items: [] };

const existing = new Set(parsed.items.map((i: any) => i.id));
const newItems = items.filter((i: any) => i && !existing.has(i.id));

parsed.items = [...parsed.items, ...newItems];

await fs.writeFile(path, JSON.stringify(parsed));
```

❌ Example (bad):

```ts
if (!user || items.length === 0) return;
const dir = getUserDir(user);
const path = getUserFilePath(user);
await fs.mkdirp(dir);
const current = await readFile(path);
const parsed = current ? JSON.parse(current) : { items: [] };
const existing = new Set(parsed.items.map((i: any) => i.id));
const newItems = items.filter((i: any) => i && !existing.has(i.id));
parsed.items = [...parsed.items, ...newItems];
await fs.writeFile(path, JSON.stringify(parsed));
```

## 6. React component properties

Extract complex prop objects into an interface and destructure
outside the function definition to help readability.

✅ Example (good):

```ts
interface MessagePartsProps {
  message: Message;
  streaming?: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function MessagePartsRenderer(props: MessagePartsProps) {
  const { message, streaming, onOpenFile } = props;
  ...
}
```

❌ Example (bad):

```ts
export function MessagePartsRenderer({
  message,
  streaming,
  onOpenFile,
}: {
  message: Message;
  streaming?: boolean;
  onOpenFile?: (filePath: string) => void;
}) {
  ...
}
```

## 7. Avoid specifying output types:

✅ Example (good):

```ts
function getUserName(user: { firstName: string; lastName: string }) {
  return `${user.firstName} ${user.lastName}`;
}
```

❌ Example (bad):

```ts
function getUserName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}
```

## 8. Use maps instead of complex if / else or ternaries

✅ Example (good):

```ts
const statusText = getStatusText({
  isError,
  isDone,
  isInputStreaming,
  isInputAvailable,
  providerExecuted,
  streaming,
});
```

❌ Example (bad):

```ts
const statusText = isError
  ? "Error"
  : isDone
    ? "Done"
    : isInputStreaming
      ? "Running"
      : isInputAvailable
        ? providerExecuted
          ? "Running"
          : "Queued"
        : streaming
          ? "Running"
          : "Waiting";
```

## 9. Avoid using `void` when calling functions

✅ Example (good):

```ts
hello("world");
```

❌ Example (bad):

```ts
void hello("world");
```

## 10. Keep files shorter than 400 lines
