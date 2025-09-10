export {
  commitAll,
  ensureRepo,
  getRepoStatus,
  listCommits,
  type CommitAllOptions,
  type CommitAllResult,
  type CommitAuthor,
  type CommitEntry,
  type GitContext,
  type RepoStatus,
} from "./git/git";
export { applyPatchInOPFS as patch } from "./git/patch";
export { getDirectoryHandle, stripAnsi } from "./shared";
export { runOpfsCommandLine } from "./shell/opfs-shell";
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
