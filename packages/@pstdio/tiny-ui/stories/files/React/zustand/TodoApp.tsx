import type { CSSProperties } from "react";
import { useMemo } from "react";

import { TodoInput } from "./TodoInput";
import { TodoList } from "./TodoList";
import { TodoStats } from "./TodoStats";
import { useTodoStore } from "./store/useTodoStore";

const containerStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  padding: "1.5rem",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const contentStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const clearButtonStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  color: "#e2e8f0",
  transition: "background 0.15s ease",
};

export function TodoApp() {
  const todos = useTodoStore((state) => state.todos);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);
  const clearCompleted = useTodoStore((state) => state.clearCompleted);

  const remaining = useMemo(() => todos.filter((item) => !item.completed).length, [todos]);
  const completed = todos.length - remaining;
  const hasCompleted = completed > 0;

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: 0 }}>Kaset Zustand Demo</h2>
      <p style={{ marginTop: 0, color: "#94a3b8" }}>
        Multiple files compiled with esbuild-wasm and wired with Zustand state.
      </p>
      <div style={contentStyle}>
        <TodoInput />
        <TodoList onToggle={toggleTodo} todos={todos} />
      </div>
      <TodoStats remaining={remaining} total={todos.length} />
      <button
        onClick={clearCompleted}
        disabled={!hasCompleted}
        style={{
          ...clearButtonStyle,
          background: hasCompleted ? "#f97316" : "#1e293b",
          cursor: hasCompleted ? "pointer" : "not-allowed",
          opacity: hasCompleted ? 1 : 0.6,
        }}
        type="button"
      >
        Clear completed ({completed})
      </button>
    </div>
  );
}
