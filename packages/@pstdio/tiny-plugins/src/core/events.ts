export class Emitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<(payload: T[keyof T]) => void>>();

  on<K extends keyof T>(event: K, cb: (payload: T[K]) => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(cb as (payload: T[keyof T]) => void);
    this.listeners.set(event, set);
    return () => {
      set.delete(cb as (payload: T[keyof T]) => void);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<K extends keyof T>(event: K, payload: T[K]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        (listener as (payload: T[K]) => void)(payload);
      } catch (error) {
        console.error("[tiny-plugins] listener error", error);
      }
    }
  }
}
