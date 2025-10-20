import { createHost } from "./host";
import { PluginChangePayload } from "./types";

type Host = ReturnType<typeof createHost>;

export interface PluginFilesChange {
  pluginId: string;
  payload: PluginChangePayload;
}

export type PluginFilesListener = (changes: PluginFilesChange[]) => void;

type MicrotaskScheduler = (callback: () => void) => void;

const scheduleMicrotask: MicrotaskScheduler =
  typeof queueMicrotask === "function"
    ? queueMicrotask
    : (callback) => {
        Promise.resolve()
          .then(callback)
          .catch((error) => {
            setTimeout(() => {
              throw error;
            }, 0);
          });
      };

export function subscribeToPluginFiles(host: Host, listener: PluginFilesListener) {
  let disposed = false;
  let scheduled = false;
  const queue: PluginFilesChange[] = [];

  const flush = () => {
    scheduled = false;
    if (disposed || queue.length === 0) return;
    const batch = queue.splice(0, queue.length);
    listener(batch);
  };

  const scheduleFlush = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    scheduleMicrotask(flush);
  };

  const unsubscribe = host.onPluginChange((pluginId, payload) => {
    if (disposed) return;
    queue.push({ pluginId, payload });
    scheduleFlush();
  });

  return () => {
    disposed = true;
    scheduled = false;
    queue.length = 0;
    unsubscribe();
  };
}
