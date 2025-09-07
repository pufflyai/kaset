import { useEffect, useMemo, useRef, useState } from "react";

export function useThinkingTimer(streaming: boolean) {
  const startRef = useRef<number | null>(null);
  const [lastThinkingMs, setLastThinkingMs] = useState<number | null>(null);

  useEffect(() => {
    if (streaming) {
      if (startRef.current == null) {
        startRef.current = performance.now();
        setLastThinkingMs(null);
      }
      return;
    }

    if (startRef.current != null) {
      setLastThinkingMs(performance.now() - startRef.current);
      startRef.current = null;
    }
  }, [streaming]);

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.round((ms % 60_000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const statusText = useMemo(() => {
    if (streaming) return "Thinking...";
    if (lastThinkingMs == null) return null;
    return `Thought for ${formatDuration(lastThinkingMs)}`;
  }, [streaming, lastThinkingMs]);

  return { lastThinkingMs, statusText };
}
