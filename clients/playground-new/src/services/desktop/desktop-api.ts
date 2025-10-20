import { openDesktopFilePreview } from "@/state/actions/desktop";

export const desktopAPI = {
  "desktop.openFilePreview": (payload: { path: string }) => {
    openDesktopFilePreview(payload.path);
  },
};
