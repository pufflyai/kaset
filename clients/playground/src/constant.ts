export const ROOT = "playground";
export const PLUGIN_ROOT = `${ROOT}/plugins`;
export const PLUGIN_DATA_ROOT = `${ROOT}/plugin_data`;
export const DEFAULT_WALLPAPER = `${ROOT}/wallpaper/kaset.png`;

export const APPROVAL_GATED_TOOL_IDS = [
  "opfs_write_file",
  "opfs_delete_file",
  "opfs_patch",
  "opfs_upload_files",
  "opfs_move_file",
] as const;

export const DEFAULT_APPROVAL_GATED_TOOLS = [];

export const examplePrompts = [
  "What can you do?",
  "Add a button to the hello-kaset plugin that makes confetti",
  "Make a todo list for surviving Monday",
  "Make a heroic quest todo-list for surviving a trip to IKEA",
  "Add a search bar to the file explorer",
];
