export {
  attachHeadToBranch,
  checkoutAtCommit,
  commitAll,
  continueFromCommit,
  ensureRepo,
  getHeadState,
  getRepoStatus,
  listAllCommits,
  listCommits,
  previewCommit,
  resolveOid,
  revertToCommit,
  safeAutoCommit,
  type AttachHeadOptions,
  type CheckoutAtCommitOptions,
  type CheckoutAtCommitResult,
  type CommitAllOptions,
  type CommitAllResult,
  type CommitAuthor,
  type CommitEntry,
  type CommitEntryWithRefs,
  type ContinueFromCommitOptions,
  type GitContext,
  type HeadState,
  type ListAllCommitsOptions,
  type RepoStatus,
  type RevertToCommitOptions,
  type RevertToCommitResult,
} from "./git/git";
export { applyPatchInOPFS as patch } from "./git/patch";
export { ensureDirExists, getDirectoryHandle, stripAnsi } from "./shared";
export { runOpfsCommandLine } from "./shell/opfs-shell";
export { createJsonFileStorage, type JsonFileStorage, type JsonFileStorageOptions } from "./state/json-storage";
export { bindStoreToJsonFile, type BindStoreOptions, type StoreAdapter } from "./state/store-binding";
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
