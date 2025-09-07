import { getDirectoryHandle, getOPFSRoot, uploadFilesToDirectory } from "@pstdio/opfs-utils";
import { useRef, useState } from "react";

export type DragAndDropHandlers = {
  isDragging: boolean;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>;
};

type UseDragAndDropUploadOptions = {
  /** Directory name in OPFS where files will be uploaded */
  targetDir: string;
  /** Optional callback when upload completes successfully */
  onUploaded?: (files: File[]) => void;
};

export function useDragAndDropUpload({ targetDir, onUploaded }: UseDragAndDropUploadOptions): DragAndDropHandlers {
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  // Ensure an OPFS directory path exists (mkdir -p behavior)
  async function ensureDir(path: string): Promise<FileSystemDirectoryHandle> {
    try {
      return await getDirectoryHandle(path);
    } catch (err: any) {
      if (err?.name !== "NotFoundError" && err?.code !== 404) throw err;

      const root = await getOPFSRoot();
      const parts = path.split("/").filter(Boolean);

      let current = root;
      for (const part of parts) {
        current = await current.getDirectoryHandle(part, { create: true });
      }

      return current;
    }
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    dragDepthRef.current = 0;
    setIsDragging(false);

    const dt = e.dataTransfer;
    const files = dt?.files ? Array.from(dt.files) : [];
    if (!files.length) return;

    try {
      const dir = await ensureDir(targetDir);
      await uploadFilesToDirectory(dir, files);
      onUploaded?.(files);
    } catch (err) {
      console.error("Failed to upload dropped files:", err);
    }
  };

  return {
    isDragging,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}

export default useDragAndDropUpload;
