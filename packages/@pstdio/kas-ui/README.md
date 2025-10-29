# @pstdio/kas-ui

Kas UI provides reusable React primitives for rendering Kaset conversations and tool output. It includes a managed
conversation store, timeline components, and adapters that make it easy for hosts to customize how tool invocations are
visualized.

## Configuring the provider

Wrap your application in `KasUIProvider` to initialize the conversation store. You can now extend the provider with
rendering configuration, including custom tool renderers that augment the timeline output.

```tsx
import { KasUIProvider, createDefaultToolRenderers } from "@pstdio/kas-ui";

const toolRenderers = createDefaultToolRenderers();

export function App() {
  return <KasUIProvider toolRenderers={toolRenderers}>{/* application UI */}</KasUIProvider>;
}
```

`KasUIProvider` accepts any `KasUIConfig` properties directly. Today this includes a `toolRenderers` record where keys are
Kas tool invocation types (for example `tool-opfs_ls`) and values are `ToolRenderer` functions.

## Tool renderer adapters

`@pstdio/kas-ui` exposes a reusable tool-rendering adapter to build timeline data structures from the Kas runtime. This
keeps Kas UI components framework-agnostic and allows hosts to register custom renderers without modifying package
internals.

Key exports:

- `createDefaultToolRenderers()` – returns the default renderers that ship with Kas UI (OPFS helpers, diff renderers, etc.)
- `ToolRenderer` / `ToolRenderersMap` – types describing renderer functions
- `buildTimelineDocFromInvocations(invocations, options)` – converts tool invocations into a `TimelineDoc` using the
  provided renderer map
- `useToolTimelineBuilder()` – hook that provides a memoized builder using the renderer map registered with the provider

Renderers return `ToolRendererResult` objects describing the timeline entry (title segments, blocks, indicator, and
expandable flag). You can override default renderers or register new ones:

```tsx
import {
  KasUIProvider,
  createDefaultToolRenderers,
  type ToolRenderersMap,
  type ToolRendererResult,
} from "@pstdio/kas-ui";

const customRenderers: ToolRenderersMap = {
  "tool-custom": (invocation) =>
    ({
      title: [{ kind: "text", text: "Ran custom tool", bold: true }],
      blocks: [{ type: "text", text: `Result: ${(invocation as any).output}` }],
    }) satisfies ToolRendererResult,
};

const toolRenderers = {
  ...createDefaultToolRenderers(),
  ...customRenderers,
};

export function App() {
  return <KasUIProvider toolRenderers={toolRenderers}>{/* ... */}</KasUIProvider>;
}
```

Within Kas UI components (or downstream hosts) you can access the renderer map or build timeline docs using the provided
hooks:

```tsx
import { useToolTimelineBuilder } from "@pstdio/kas-ui";

function ToolTimeline({ invocations }) {
  const buildTimeline = useToolTimelineBuilder();
  const data = buildTimeline(invocations);
  return <TimelineFromJSON data={data} />;
}
```

For more granular control you can use `useToolRenderers()` to obtain the raw map or `useToolRenderer(toolType)` to read
an individual renderer.
