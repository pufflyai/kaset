import type { Conversation, WorkspaceLocalState, WorkspaceStore } from "../types";

/**
 * Merge two local states, keep the values that are defined.
 * When we load the persisted state, values that are already defined in the store should not be overwritten.
 *
 * @param persistedState The state that was persisted locally
 * @param currentState The state from the store (initialized e.g. from the url)
 * @returns
 */
type PersistedShape = {
  version?: string;
  conversations?: Record<string, Conversation>;
  local?: WorkspaceLocalState;
};

export const mergeLocalState = (persistedState: unknown, currentState: WorkspaceStore) => {
  const persisted: PersistedShape | null = isPersistedShape(persistedState) ? persistedState : null;

  // Start from current state (derived from app defaults and URL params)
  const merged: WorkspaceStore = {
    ...currentState,
    // Prefer persisted conversations if present, otherwise keep current
    conversations:
      persisted?.conversations && Object.keys(persisted.conversations).length > 0
        ? persisted.conversations
        : currentState.conversations,
  };

  // Keep local from current state (URL-driven), but ensure selection is valid
  const conversationIds = Object.keys(merged.conversations);
  const selected = merged.local?.selectedConversationId;
  const selectedExists = selected ? conversationIds.includes(selected) : false;

  merged.local = {
    ...merged.local,
    selectedConversationId: selectedExists ? selected : conversationIds[0],
  };

  return merged;
};

function isPersistedShape(value: unknown): value is PersistedShape {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  const convOk = !("conversations" in v) || (v.conversations && typeof v.conversations === "object");
  const localOk = !("local" in v) || (v.local && typeof v.local === "object");
  return convOk && (localOk as any);
}
