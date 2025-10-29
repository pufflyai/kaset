import { createContext, useCallback, useContext, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { buildTimelineDocFromInvocations } from "../adapters/tool-rendering/build-timeline.ts";
import { createDefaultToolRenderers } from "../adapters/tool-rendering/default-renderers.tsx";
import type { ToolRenderer, ToolRenderersMap, ToolTimelineBuilder } from "../adapters/tool-rendering/types.ts";
import { createConversationStore } from "./createConversationStore";
import type { ConversationStore } from "./createConversationStore";
import type { ConversationStoreState } from "./types";

export const ConversationStoreContext = createContext<ConversationStore | null>(null);

interface ToolRenderingContextValue {
  toolRenderers: ToolRenderersMap;
}

const ToolRenderingContext = createContext<ToolRenderingContextValue | null>(null);

export let useConversationStore: ConversationStore;

export interface KasUIConfig {
  toolRenderers?: ToolRenderersMap;
}

export interface KasUIProviderProps extends KasUIConfig {
  children: ReactNode;
}

export function KasUIProvider(props: KasUIProviderProps) {
  const { children, toolRenderers } = props;
  const storeRef = useRef<ConversationStore | null>(null);
  const defaultToolRenderersRef = useRef<ToolRenderersMap | null>(null);

  if (!storeRef.current) {
    useConversationStore = createConversationStore();
    storeRef.current = useConversationStore;
  }

  if (!defaultToolRenderersRef.current) {
    defaultToolRenderersRef.current = createDefaultToolRenderers();
  }

  const mergedToolRenderers = useMemo(() => {
    const base = defaultToolRenderersRef.current!;
    if (!toolRenderers || Object.keys(toolRenderers).length === 0) {
      return { ...base };
    }

    return { ...base, ...toolRenderers };
  }, [toolRenderers]);

  const toolRenderingContextValue = useMemo<ToolRenderingContextValue>(() => {
    return { toolRenderers: mergedToolRenderers };
  }, [mergedToolRenderers]);

  const store = storeRef.current!;

  return (
    <ConversationStoreContext.Provider value={store}>
      <ToolRenderingContext.Provider value={toolRenderingContextValue}>{children}</ToolRenderingContext.Provider>
    </ConversationStoreContext.Provider>
  );
}

export const getConversationStore = (): ConversationStore => {
  if (!useConversationStore) {
    throw new Error("Kas UI store has not been initialized. Ensure KasUIProvider is mounted.");
  }

  return useConversationStore;
};

export const getConversationStoreState = (): ConversationStoreState => {
  return getConversationStore().getState();
};

const useToolRenderingContext = () => {
  const context = useContext(ToolRenderingContext);
  if (!context) {
    throw new Error("Kas UI tool rendering configuration is unavailable. Ensure KasUIProvider is mounted.");
  }

  return context;
};

export const useToolRenderers = (): ToolRenderersMap => {
  return useToolRenderingContext().toolRenderers;
};

export const useToolRenderer = (toolType: string): ToolRenderer | undefined => {
  const renderers = useToolRenderers();
  return renderers[toolType];
};

export const useToolTimelineBuilder = (): ToolTimelineBuilder => {
  const renderers = useToolRenderers();

  return useCallback<ToolTimelineBuilder>(
    (invocations, options) => {
      return buildTimelineDocFromInvocations(invocations, { ...options, toolRenderers: renderers });
    },
    [renderers],
  );
};
