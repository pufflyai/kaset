export { runOpfsCommandLine } from "./cli/opfs-shell";
export { getDirectoryHandle, getOPFSRoot, stripAnsi } from "./shared";
export { deleteFile, downloadFile, moveFile, readFile, writeFile } from "./utils/opfs-crud";
export {
  DEFAULT_MAX_LINES_TEXT_FILE,
  getSpecificMimeType,
  MAX_LINE_LENGTH_TEXT_FILE,
  processSingleFileContent,
  type ProcessedFileReadResult,
  type ProcessSingleFileOptions,
} from "./utils/opfs-files";
export { grep } from "./utils/opfs-grep";
export { formatTree, ls } from "./utils/opfs-ls";
export { applyPatchInOPFS as patch } from "./utils/opfs-patch";
export {
  pickAndUploadFilesToDirectory,
  uploadFilesToDirectory,
  type FileUploadBaseOptions,
  type FileUploadResult,
} from "./utils/opfs-upload";
export {
  watchDirectory,
  watchOPFS,
  type ChangeRecord,
  type DirectoryWatcherCleanup,
  type WatchOptions,
} from "./utils/opfs-watch";
export {
  basename,
  hasParentTraversal,
  isWithinRoot,
  joinPath,
  joinUnderWorkspace,
  normalizeSegments,
  normalizeSlashes,
  parentOf,
} from "./utils/path";
