export interface TodoItem {
  line: number;
  text: string;
  done: boolean;
}

export interface TodoStore {
  error: string | null;
  lists: string[];
  selectedList: string | null;
  content: string | null;
  items: TodoItem[];
  newListName: string;
  newItemText: string;
  editingLine: number | null;
  editingText: string;
  deleteModalOpen: boolean;
  pendingDeleteList: string | null;
  setNewListName: (value: string) => void;
  setNewItemText: (value: string) => void;
  setEditingText: (value: string) => void;
  setError: (message: string | null) => void;
  refreshLists: () => Promise<void>;
  readAndParse: (fileName: string) => Promise<void>;
  selectList: (name: string) => Promise<void>;
  addList: () => Promise<void>;
  removeList: (name: string) => Promise<void>;
  requestDeleteList: (name: string) => void;
  cancelDeleteList: () => void;
  confirmDeleteList: () => Promise<void>;
  setChecked: (line: number, checked: boolean) => Promise<void>;
  addItem: () => Promise<void>;
  removeItem: (line: number) => Promise<void>;
  startEditing: (line: number, currentText: string) => void;
  cancelEditing: () => void;
  saveEditing: () => Promise<void>;
  initialize: () => Promise<void>;
}
