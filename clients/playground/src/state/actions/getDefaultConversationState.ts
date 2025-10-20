import { DEFAULT_STATE } from "../defaultState";
import type { Conversation } from "../types";

const FALLBACK_CONVERSATION: Conversation = {
  id: "default",
  name: "Conversation",
  messages: [],
};

const cloneConversation = (conversation: Conversation): Conversation => ({
  ...conversation,
  messages: [],
});

const buildDefaultConversations = (): Record<string, Conversation> => {
  const entries = Object.entries(DEFAULT_STATE.conversations);
  if (entries.length === 0) {
    return {
      [FALLBACK_CONVERSATION.id]: cloneConversation(FALLBACK_CONVERSATION),
    };
  }

  return entries.reduce<Record<string, Conversation>>((acc, [id, conversation]) => {
    acc[id] = cloneConversation(conversation as Conversation);
    return acc;
  }, {});
};

export const getDefaultConversationState = () => {
  const conversations = buildDefaultConversations();
  const preferredId = DEFAULT_STATE.selectedConversationId;
  const selectedConversationId = conversations[preferredId] ? preferredId : Object.keys(conversations)[0];

  return {
    conversations,
    selectedConversationId,
  };
};
