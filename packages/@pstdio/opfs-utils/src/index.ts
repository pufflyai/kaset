export { createScopedFs, type ScopedFs } from "./adapter/scoped-fs";
export {
  type AttachHeadOptions,
  attachHeadToBranch,
  type CheckoutAtCommitOptions,
  type CheckoutAtCommitResult,
  type CommitAllOptions,
  type CommitAllResult,
  type CommitAuthor,
  type CommitEntry,
  type CommitEntryWithRefs,
  type ContinueFromCommitOptions,
  checkoutAtCommit,
  commitAll,
  continueFromCommit,
  ensureRepo,
  type GitContext,
  getHeadState,
  getRepoStatus,
  type HeadState,
  type ListAllCommitsOptions,
  listAllCommits,
  listCommits,
  previewCommit,
  type RepoStatus,
  type RevertToCommitOptions,
  type RevertToCommitResult,
  resolveOid,
  revertToCommit,
  safeAutoCommit,
} from "./git/git";
export { applyPatchInOPFS as patch } from "./git/patch";
export { ensureDirExists, getDirectoryHandle, stripAnsi } from "./shared";
export { runOpfsCommandLine } from "./shell/opfs-shell";
export { createJsonFileStorage, type JsonFileStorage, type JsonFileStorageOptions } from "./state/json-storage";
export { type BindStoreOptions, bindStoreToJsonFile, type StoreAdapter } from "./state/store-binding";
export {
  type BinaryLike,
  deleteDirectory,
  deleteDirectoryContents,
  deleteFile,
  downloadFile,
  moveFile,
  type ReadFileOptions,
  readFile,
  type WriteFileOptions,
  writeFile,
} from "./utils/opfs-crud";
export {
  DEFAULT_MAX_LINES_TEXT_FILE,
  getSpecificMimeType,
  MAX_LINE_LENGTH_TEXT_FILE,
  type ProcessedFileReadResult,
  type ProcessSingleFileOptions,
  processSingleFileContent,
} from "./utils/opfs-files";
export { grep } from "./utils/opfs-grep";
export { formatTree, type LsEntry, type LsOptions, ls } from "./utils/opfs-ls";
export {
  type FileUploadBaseOptions,
  type FileUploadResult,
  pickAndUploadFilesToDirectory,
  uploadFilesToDirectory,
} from "./utils/opfs-upload";
export {
  type ChangeRecord,
  type DirectoryWatcherCleanup,
  type WatchOptions,
  watchDirectory,
  watchOPFS,
} from "./utils/opfs-watch";
export {
  basename,
  hasParentTraversal,
  isWithinRoot,
  joinPath,
  joinUnderWorkspace,
  type NormalizeRootOptions,
  normalizeRelPath,
  normalizeRoot,
  normalizeSegments,
  normalizeSlashes,
  parentOf,
} from "./utils/path";
