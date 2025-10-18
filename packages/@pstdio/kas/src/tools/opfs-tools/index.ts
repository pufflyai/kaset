import { Tool } from "@pstdio/tiny-ai-tasks";
import { ApprovalGate } from "../../approval";
import { opfs_delete_file, opfs_delete_file_definition } from "./opfs-delete-file";
import { opfs_download_file, opfs_download_file_definition } from "./opfs-download-file";
import { opfs_grep, opfs_grep_definition } from "./opfs-grep";
import { opfs_ls, opfs_ls_definition } from "./opfs-ls";
import { opfs_move_file, opfs_move_file_definition } from "./opfs-move-file";
import { opfs_patch, opfs_patch_definition } from "./opfs-patch";
import { opfs_read_file, opfs_read_file_definition } from "./opfs-read-file";
import { opfs_shell, opfs_shell_definition } from "./opfs-shell";
import { opfs_upload_files, opfs_upload_files_definition } from "./opfs-upload-file";
import { opfs_write_file, opfs_write_file_definition } from "./opfs-write-file";

export type CreateOpfsToolsOptions = {
  rootDir: string;
  approvalGate: ApprovalGate;
};

export const createOpfsTools = (options: CreateOpfsToolsOptions) => {
  const { rootDir, approvalGate } = options;

  return [
    Tool(opfs_shell({ rootDir, approvalGate }), opfs_shell_definition),
    Tool(opfs_ls({ rootDir, approvalGate }), opfs_ls_definition),
    Tool(opfs_grep({ rootDir, approvalGate }), opfs_grep_definition),
    Tool(opfs_read_file({ rootDir, approvalGate }), opfs_read_file_definition),
    Tool(opfs_write_file({ rootDir, approvalGate }), opfs_write_file_definition),
    Tool(opfs_delete_file({ rootDir, approvalGate }), opfs_delete_file_definition),
    Tool(opfs_patch({ rootDir, approvalGate }), opfs_patch_definition),
    Tool(opfs_upload_files({ rootDir, approvalGate }), opfs_upload_files_definition),
    Tool(opfs_download_file({ rootDir, approvalGate }), opfs_download_file_definition),
    Tool(opfs_move_file({ rootDir, approvalGate }), opfs_move_file_definition),
  ];
};
