import { scan, setOptions } from "react-scan";

let initialized = false;

export const updateReactScanState = (enabled: boolean) => {
  if (!initialized) {
    scan();
    initialized = true;
  }

  setOptions({ showToolbar: enabled, enabled: false });
};
