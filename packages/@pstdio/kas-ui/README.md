# @pstdio/kas-ui

Kas UI provides React primitives used by the Kaset playground and the Kas agent runtime. Components are Chakra UI based and cover the conversation timeline, tool invocation rendering, and shared utility widgets.

## Development

Install dependencies from the monorepo root:

```bash
npm install
```

Then use the workspace scripts when iterating locally:

```bash
# Build the library bundle
npm run build --workspace @pstdio/kas-ui

# Type-check and run Vitest
npm run test --workspace @pstdio/kas-ui

# Lint the source files
npm run lint --workspace @pstdio/kas-ui
```

## Storybook

Interactive documentation for the primitives lives in Storybook. Launch it locally with:

```bash
npm run storybook --workspace @pstdio/kas-ui
```

This spins up a Vite-powered Storybook instance configured with the Kas UI Chakra theme and providers so stories render without the playground shell. To produce a static build (used by CI), run:

```bash
npm run storybook:build --workspace @pstdio/kas-ui
```

The Storybook build step is part of the main CI workflow to catch integration issues alongside lint, build, and test checks.
