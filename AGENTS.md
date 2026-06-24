# Repo Rules

- **Lerna + Bun-managed monorepo** with **Nx caching**. **TypeScript only**.
- Use **Bun**, not `npm`, `yarn`, or `pnpm`. Bun `>=1.3.13` is required.
- This repo provides browser-first utilities under the `@pstdio` scope: OPFS helpers, OPFS <-> remote sync, prompt utilities, Tiny task/plugin/UI packages, and a folder-to-markdown descriptor.
- Workspaces live under `packages/**` and `clients/*`.
- Your work is not done until the required validation passes.

Key configuration:

- Root: `package.json`, `lerna.json`, `nx.json`
- Per package: `package.json`, `tsconfig.json`, `vite.config.ts`, optional `vitest.config.ts`

# Coding Rules

Never compromise the project structure. Readability and structure matter more than compact code.

- Keep things simple.
- Preserve or improve the package boundaries.
- Assume the happy path first.
- Do not add defensive or speculative code.
- Clean up legacy or unused code when it is directly related to the change.
- Prefer `@pstdio/<package>` imports between packages.
- Keep imports at the top of the file.

Not allowed:

- Deep relative imports across packages, such as `../../../other-package`.
- Imports from `clients/*` inside packages.
- Adding new package managers or package-manager lockfiles.
- Moving unrelated code while making a focused change.

## Required Workflow: TDD

Follow this loop for code changes.

### 1. Red - Write the test first

- Skip only when no valid test is applicable.
- Reproduce a bug before fixing it.
- Write the smallest Vitest test that proves the behavior.
- Keep tests next to the file they test.
- Confirm the test fails for the right reason.

Not allowed:

- Tests for documentation-only changes.
- Tests for config-only changes.
- Tests that assert generated file wording.
- Tests that only lock implementation details.
- Tests that prove removed behavior stays absent.

### 2. Green - Make it pass

- Write the minimum code needed.
- Avoid premature generalization.
- Prefer simple happy-path code.
- Run focused package tests often.

### 3. Refactor - Clean up

- Improve readability.
- Delete unused or legacy code touched by the change.
- Keep files under roughly 350 lines.
- Split files early when responsibilities start to diverge.
- Update documentation when behavior, commands, or public APIs change.
- Remove or update tests that only cover old implementation details.

Tests must stay green.

### 4. Prove It Works

Skip this only for documentation-only changes.

Before completing a task, run this sequence from the repo root:

```bash
bun run format
bun run lint
bun run build
bun run test
```

Fix any remaining failures.

For focused package checks:

```bash
bun run --filter <name> build
bun run --filter <name> test
```

Useful root commands:

- `bun run format`
- `bun run format:check`
- `bun run lint`
- `bun run build`
- `bun run test`
- `bun run clean`
- `bun run reset:all`

# Fixing Bugs

- Always reproduce the issue before fixing it.
- Always write a regression test first unless no valid test is applicable.
- Keep the fix scoped to the broken behavior.
- Prefer testing active user-facing behavior and public contracts over implementation details.

# Package Commands

Common package checks:

```bash
bun run --filter @pstdio/kas build
bun run --filter @pstdio/kas test
bun run --filter @pstdio/opfs-utils build
bun run --filter @pstdio/opfs-utils test
bun run --filter @pstdio/opfs-hooks build
bun run --filter @pstdio/opfs-hooks test
bun run --filter @pstdio/opfs-sync build
bun run --filter @pstdio/opfs-sync test
bun run --filter @pstdio/prompt-utils build
bun run --filter @pstdio/prompt-utils test
bun run --filter @pstdio/tiny-ai-tasks build
bun run --filter @pstdio/tiny-ai-tasks test
bun run --filter @pstdio/tiny-plugins build
bun run --filter @pstdio/tiny-plugins test
bun run --filter @pstdio/tiny-tasks build
bun run --filter @pstdio/tiny-tasks test
bun run --filter @pstdio/tiny-ui build
bun run --filter @pstdio/tiny-ui test
bun run --filter @pstdio/tiny-ui-bundler build
bun run --filter @pstdio/tiny-ui-bundler test
bun run --filter describe-context build
```

Documentation site:

```bash
bun run --filter documentation start
bun run --filter documentation build
```

Playground:

```bash
bun run --filter playground start
bun run --filter playground build
```

Storybook packages expose their own `storybook` scripts. Use package-local Storybook checks when a visual UI change is better covered by a story than by a brittle unit test.

# Git

- Work with the current branch unless the user asks for a branch change.
- Keep unrelated worktree changes out of your edits.
- Do not revert, reset, or rewrite user changes unless explicitly requested.
- Do not create commits or PRs unless explicitly requested.

# Coding Style Rules

- Use whitespace to separate logical sections: setup, async work, parsing/transformation, and return.
- Group related statements together and separate unrelated steps with blank lines.
- Prefer clear, spaced code over dense compact code.
- Split content that will grow into separate files.
- Prefer pure functions when practical.
- Comment **why**, not **what**.
- Do **not** specify return types when TypeScript can infer them.
- Avoid nested ternaries.
- Prefer maps or small helper functions over complex `if` / `else` chains.
- Avoid calling functions with `void`.
- Keep files shorter than roughly 350 lines.
- Keep code simple; do not add defensive checks unless they protect an active contract.

## React Rules

- Extract complex prop objects into an interface.
- Destructure props inside the function body.
- Prefer components over render helper functions when UI logic needs extracting.
- Keep component state and effects scoped to the component that owns the behavior.

Example:

```ts
interface MessagePartsProps {
  message: Message;
  streaming?: boolean;
  onOpenFile?: (filePath: string) => void;
}

export function MessagePartsRenderer(props: MessagePartsProps) {
  const { message, streaming, onOpenFile } = props;
}
```

## Testing Rules

- Tests must live next to the file they test.
- Use Vitest; do not introduce another test framework.
- Avoid mocks when the real dependency is practical.
- Bug fixes must add or update a regression test first.
- Test supported behavior and active contracts.
- Negative tests should cover active validation, permissions, and error handling contracts.
- When removing a feature, delete or update its tests instead of adding absence tests.

