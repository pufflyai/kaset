import { useState } from "react";

export type FileNode = {
  id: string;
  name: string;
  children?: FileNode[];
};

export const useFileContent = (_path?: string) => {
  // TODO: implement

  const [content] = useState("");
  return { content };
};

export const useFolder = (_path?: string) => {
  // TODO: implement

  const [rootNode] = useState<FileNode | null>(null);
  return { rootNode };
};
