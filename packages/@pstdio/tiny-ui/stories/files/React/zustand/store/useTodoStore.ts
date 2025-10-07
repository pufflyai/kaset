import { useRef, useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoState {
  todos: TodoItem[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  clearCompleted: () => void;
}

type Selector<T> = (state: TodoState) => T;

const randomId = () => Math.random().toString(36).slice(2, 10);

const store = createStore<TodoState>((set) => ({
  todos: [
    { id: "welcome", text: "Welcome to Tiny UI", completed: false },
    { id: "bundle", text: "Bundles persist via OPFS cache", completed: true },
  ],
  addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    set((state) => ({
      ...state,
      todos: [
        ...state.todos,
        { id: randomId(), text: trimmed, completed: false },
      ],
    }));
  },
  toggleTodo(id) {
    set((state) => ({
      ...state,
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    }));
  },
  clearCompleted() {
    set((state) => ({
      ...state,
      todos: state.todos.filter((todo) => !todo.completed),
    }));
  },
}));

export const todoStore = store;

export function useTodoStore<T>(selector: Selector<T>) {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  return useSyncExternalStore(
    store.subscribe,
    () => selectorRef.current(store.getState()),
    () => selectorRef.current(store.getState()),
  );
}
