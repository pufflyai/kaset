export {
  DEFAULT_MAX_LINES_TEXT_FILE,
  getSpecificMimeType,
  MAX_LINE_LENGTH_TEXT_FILE,
  processSingleFileContent,
  type ProcessedFileReadResult,
} from "./utils/opfs-files";
export { grep } from "./utils/opfs-grep";
export { ls } from "./utils/opfs-ls";
export { formatTree } from "./utils/opfs-ls";
export { applyPatchInOPFS as patch } from "./utils/opfs-patch";
