export class Emitter<T extends Record<string, unknown>> {
  private listeners = new Map<keyof T, Set<(payload: T[keyof T]) => void>>();

  on<K extends keyof T>(event: K, cb: (payload: T[K]) => void) {
    const bucket = this.listeners.get(event) ?? new Set();
    bucket.add(cb as (payload: T[keyof T]) => void);
    this.listeners.set(event, bucket);
    return () => bucket.delete(cb as (payload: T[keyof T]) => void);
  }

  emit<K extends keyof T>(event: K, payload: T[K]) {
    const bucket = this.listeners.get(event);
    if (!bucket) return;
    for (const cb of bucket) {
      try {
        (cb as (payload: T[K]) => void)(payload);
      } catch (error) {
        console.error("[tiny-plugins] emitter listener failed", error);
      }
    }
  }
}
