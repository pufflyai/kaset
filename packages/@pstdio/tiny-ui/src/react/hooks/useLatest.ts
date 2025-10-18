import { useEffect, useRef } from "react";

/** Keeps a mutable ref pointing at the latest value without re-subscribing listeners. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref;
}
