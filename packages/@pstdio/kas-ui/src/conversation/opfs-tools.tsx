import type { ToolInvocation } from "@pstdio/kas/kas-ui";
import { createDefaultToolRenderers } from "../adapters/tool-rendering/default-renderers.tsx";
import type { ToolRendererResult } from "../adapters/tool-rendering/types.ts";

const OPFS_RENDERERS = createDefaultToolRenderers();

export function renderOpfsTool(invocation: ToolInvocation): ToolRendererResult | null {
  const type = typeof (invocation as any).type === "string" ? ((invocation as any).type as string) : undefined;
  if (!type) return null;

  const renderer = OPFS_RENDERERS[type];
  if (!renderer) return null;

  return renderer(invocation, { labeledBlocks: false });
}
