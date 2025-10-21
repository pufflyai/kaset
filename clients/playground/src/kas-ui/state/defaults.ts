import type { Conversation, ConversationState } from "./types";

const DEFAULT_CONVERSATION_ID = "default";
const DEFAULT_CONVERSATION_NAME = "Conversation 1";

const cloneConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: Array.isArray(conversation.messages) ? [...conversation.messages] : [],
});

export const createDefaultConversationState = (
  base: Pick<ConversationState, "conversations" | "selectedConversationId">,
): Pick<ConversationState, "conversations" | "selectedConversationId"> => {
  const hasConversations = Object.keys(base.conversations).length > 0;
  if (hasConversations) {
    return {
      conversations: Object.entries(base.conversations).reduce<Record<string, Conversation>>(
        (acc, [id, conversation]) => {
          acc[id] = cloneConversation(conversation);
          return acc;
        },
        {},
      ),
      selectedConversationId: base.selectedConversationId,
    };
  }

  const conversation = cloneConversation({
    id: DEFAULT_CONVERSATION_ID,
    name: DEFAULT_CONVERSATION_NAME,
    messages: [],
  });

  return {
    conversations: { [conversation.id]: conversation },
    selectedConversationId: conversation.id,
  };
};

export const ensureConversationSelection = (state: ConversationState): ConversationState => {
  const conversations = Object.entries(state.conversations).reduce<Record<string, Conversation>>(
    (acc, [id, conversation]) => {
      acc[id] = cloneConversation(conversation);
      return acc;
    },
    {},
  );

  const ids = Object.keys(conversations);
  if (ids.length === 0) {
    const defaults = createDefaultConversationState({ conversations: {}, selectedConversationId: null });
    return {
      ...state,
      conversations: defaults.conversations,
      selectedConversationId: defaults.selectedConversationId,
    };
  }

  const selected =
    state.selectedConversationId && conversations[state.selectedConversationId] ? state.selectedConversationId : ids[0];

  return {
    ...state,
    conversations,
    selectedConversationId: selected,
  };
};
