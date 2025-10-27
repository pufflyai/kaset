import { getConversationStoreState } from "../KasUIProvider";

export const getSelectedConversationId = (): string | null => {
  return getConversationStoreState().selectedConversationId;
};
