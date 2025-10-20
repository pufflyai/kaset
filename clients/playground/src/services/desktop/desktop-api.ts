import { requestOpenDesktopFile } from "./desktop-file-icons";

export const desktopAPI = {
  "desktop.openFilePreview": (payload: { path: string }) => {
    requestOpenDesktopFile(payload.path);
  },
};
