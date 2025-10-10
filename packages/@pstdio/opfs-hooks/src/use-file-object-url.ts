import {
  basename,
  normalizeRelPath,
  parentOf,
  readFile,
  watchDirectory,
  type DirectoryWatcherCleanup,
} from "@pstdio/opfs-utils";
import { useEffect, useState } from "react";

function canUseObjectUrls() {
  return (
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function" &&
    typeof URL.revokeObjectURL === "function" &&
    typeof Blob !== "undefined"
  );
}

function toArrayBuffer(bytes: Uint8Array) {
  const { buffer, byteOffset, byteLength } = bytes;

  if (buffer instanceof ArrayBuffer) {
    const start = byteOffset;
    const end = byteOffset + byteLength;

    if (start === 0 && end === buffer.byteLength) {
      return buffer;
    }

    return buffer.slice(start, end);
  }

  const copy = new Uint8Array(byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

export const useFileObjectUrl = (path?: string) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseObjectUrls()) {
      setObjectUrl(null);
      return;
    }

    let cancelled = false;
    let stopWatch: DirectoryWatcherCleanup | null = null;
    let currentUrl: string | null = null;

    const revoke = () => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
        currentUrl = null;
      }
    };

    async function load() {
      if (!path) {
        revoke();
        if (!cancelled) setObjectUrl(null);
        return;
      }

      try {
        const bytes = await readFile(path, { encoding: null });
        const blob = new Blob([toArrayBuffer(bytes)]);
        const nextUrl = URL.createObjectURL(blob);

        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }

        revoke();
        currentUrl = nextUrl;
        setObjectUrl(nextUrl);
      } catch {
        if (cancelled) return;
        revoke();
        setObjectUrl(null);
      }
    }

    async function watch() {
      if (!path) return;

      try {
        const normalized = normalizeRelPath(path);
        if (!normalized) return;

        const dirPath = parentOf(normalized);
        const relTarget = basename(normalized);

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
      revoke();
    };
  }, [path]);

  return { objectUrl };
};
