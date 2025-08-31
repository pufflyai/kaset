import { useEffect, useState } from "react";
import { getOPFSRoot } from "../../src/shared";

type Nullable<T> = T | null;

export function useOPFS() {
  const [root, setRoot] = useState<Nullable<FileSystemDirectoryHandle>>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const dir = await getOPFSRoot();
        if (!mounted) return;
        setRoot(dir);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { root, error } as const;
}
