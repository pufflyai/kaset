import { Box, Center, Heading, Spinner, Text, chakra } from "@chakra-ui/react";
import { readFile, watchDirectory, type DirectoryWatcherCleanup } from "@pstdio/opfs-utils";
import { useEffect, useMemo, useRef, useState } from "react";

interface ImagePreviewProps {
  filePath: string;
  displayName: string;
}

const getMimeType = (filePath: string) => {
  const lower = filePath.toLowerCase();

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";

  return "application/octet-stream";
};

export const ImagePreview = (props: ImagePreviewProps) => {
  const { filePath, displayName } = props;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);

  const pathLabel = useMemo(() => {
    const normalized = filePath.replace(/^\/+/, "");
    return normalized ? `/${normalized}` : "/";
  }, [filePath]);

  useEffect(() => {
    let cancelled = false;
    let stopWatch: DirectoryWatcherCleanup | null = null;

    const resetImage = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setImageUrl(null);
    };

    const assignImage = (bytes: Uint8Array) => {
      let blobSource: ArrayBuffer;

      if (bytes.buffer instanceof ArrayBuffer) {
        const start = bytes.byteOffset;
        const end = start + bytes.byteLength;
        blobSource = bytes.buffer.slice(start, end);
      } else {
        const clone = new Uint8Array(bytes);
        blobSource = clone.buffer as ArrayBuffer;
      }

      const blob = new Blob([blobSource], { type: getMimeType(filePath) });
      const nextUrl = URL.createObjectURL(blob);

      if (cancelled) {
        URL.revokeObjectURL(nextUrl);
        return;
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }

      objectUrlRef.current = nextUrl;
      setImageUrl(nextUrl);
    };

    const load = async () => {
      if (!filePath) {
        resetImage();
        setError("No file selected.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await readFile(filePath, { encoding: null });
        if (!(result instanceof Uint8Array)) {
          throw new Error("Expected binary data for image preview.");
        }

        if (!cancelled) {
          setLoading(false);
          setError(null);
          assignImage(result);
        }
      } catch {
        if (!cancelled) {
          resetImage();
          setError("Unable to load image preview.");
          setLoading(false);
        }
      }
    };

    const watch = async () => {
      if (!filePath) return;

      try {
        const normalized = filePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
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
    };

    setLoading(true);
    setError(null);
    load();
    watch();

    return () => {
      cancelled = true;
      stopWatch?.();
      resetImage();
    };
  }, [filePath]);

  return (
    <Box height="100%" display="flex" flexDirection="column" bg="background.primary">
      <Box paddingX="md">
        <Text fontSize="xs" color="foreground.tertiary" marginTop="1">
          {pathLabel}
        </Text>
      </Box>
      <Box flex="1" padding="xs" background="background.primary">
        {loading ? (
          <Center height="100%">
            <Spinner color="foreground.tertiary" />
          </Center>
        ) : error ? (
          <Center height="100%">
            <Text fontSize="sm" color="foreground.tertiary">
              {error}
            </Text>
          </Center>
        ) : imageUrl ? (
          <Center height="100%">
            <chakra.img
              src={imageUrl}
              alt={displayName}
              maxWidth="100%"
              maxHeight="100%"
              objectFit="contain"
              borderRadius="md"
              borderWidth="1px"
              borderColor="border.secondary"
              background="background.secondary"
            />
          </Center>
        ) : (
          <Center height="100%">
            <Text fontSize="sm" color="foreground.tertiary">
              No preview available.
            </Text>
          </Center>
        )}
      </Box>
    </Box>
  );
};
