import { getConversationStore } from "../KasUIProvider";
import { getDefaultConversationSnapshot } from "../createConversationStore";

export const deleteAllConversations = () => {
  const store = getConversationStore();
  const snapshot = getDefaultConversationSnapshot();

  store.setState((draft) => {
    draft.conversations = snapshot.conversations;
    draft.selectedConversationId = snapshot.selectedConversationId;
  });
};
