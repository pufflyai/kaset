import { getDefaultConversationSnapshot } from "../createConversationStore";
import { getConversationStore } from "../KasUIProvider";

export const deleteAllConversations = () => {
  const store = getConversationStore();
  const snapshot = getDefaultConversationSnapshot();

  store.setState((draft) => {
    draft.conversations = snapshot.conversations;
    draft.selectedConversationId = snapshot.selectedConversationId;
  });
};
