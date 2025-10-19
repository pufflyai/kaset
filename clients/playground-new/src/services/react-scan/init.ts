import { scan, setOptions } from "react-scan";

let initialized = false;

export const updateReactScanState = (enabled: boolean) => {
  if (!initialized) {
    scan({ showToolbar: enabled });
    initialized = true;
    return;
  }

  setOptions({ showToolbar: enabled });
};
