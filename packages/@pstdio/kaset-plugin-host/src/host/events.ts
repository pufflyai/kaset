import type { Disposable, EventListener, Events, Logger } from "./types";

export interface EventHub {
  api: Events;
  emit(name: string, payload?: unknown): void;
  dispose(): void;
}

export const createEventHub = (logger?: Logger): EventHub => {
  const listeners = new Map<string, Set<EventListener>>();

  const off = (name: string, listener: EventListener) => {
    const existing = listeners.get(name);
    if (!existing) return;
    existing.delete(listener);
    if (existing.size === 0) {
      listeners.delete(name);
    }
  };

  const on = (name: string, listener: EventListener): Disposable => {
    if (!listeners.has(name)) {
      listeners.set(name, new Set());
    }
    listeners.get(name)!.add(listener);
    return {
      dispose: () => off(name, listener),
    };
  };

  const emit = (name: string, payload?: unknown) => {
    const handlers = listeners.get(name);
    if (!handlers?.size) return;
    for (const handler of [...handlers]) {
      try {
        const result = handler(payload);
        if (result && typeof (result as Promise<unknown>).then === "function") {
          (result as Promise<unknown>).catch((error) => {
            logger?.error?.("event handler error", { name, error });
          });
        }
      } catch (error) {
        logger?.error?.("event handler error", { name, error });
      }
    }
  };

  const dispose = () => {
    listeners.clear();
  };

  const api: Events = {
    on,
    off,
    emit,
  };

  return { api, emit, dispose };
};
