import { readFile, watchDirectory, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";
import { useEffect, useState } from "react";

export const useFileContent = (path?: string) => {
  const [content, setContent] = useState("");

  useEffect(() => {
    let cancelled = false;
    let stopWatch: DirectoryWatcherCleanup | null = null;

    async function load() {
      if (!path) {
        setContent("");
        return;
      }

      try {
        const text = await readFile(path);
        if (!cancelled) setContent(text);
      } catch {
        if (!cancelled) setContent("");
      }
    }

    async function watch() {
      if (!path) return;

      try {
        const normalized = path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
        const parts = normalized.split("/").filter(Boolean);
        const dirParts = parts.slice(0, -1);
        const relTarget = parts.slice(dirParts.length).join("/");

        const dirPath = dirParts.join("/");

        stopWatch = await watchDirectory(dirPath, (changes) => {
          for (const ch of changes) {
            const rel = ch.path.join("/");
            if (rel === relTarget) {
              load();
              break;
            }
          }
        });
      } catch {
        stopWatch?.();
        stopWatch = null;
      }
    }

    load();
    watch();

    return () => {
      cancelled = true;
      stopWatch?.();
    };
  }, [path]);

  return { content };
};
