import type { Disposable } from "../host/types";

export const disposeAll = async (disposables: Iterable<Disposable>): Promise<void> => {
  for (const disposable of disposables) {
    try {
      await disposable.dispose();
    } catch (error) {
      console.error("[kaset-plugin-host] dispose failed", error);
    }
  }
};
