import type { CSSProperties } from "react";

import type { TodoItem } from "./store/useTodoStore";

interface TodoListProps {
  todos: TodoItem[];
  onToggle: (id: string) => void;
}

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem",
  borderRadius: "8px",
  background: "#1e293b",
};

const checkboxStyle: CSSProperties = {
  width: "1.2rem",
  height: "1.2rem",
};

const emptyStateStyle: CSSProperties = {
  padding: "0.75rem",
  borderRadius: "8px",
  background: "#1e293b",
  color: "#94a3b8",
  textAlign: "center",
};

export function TodoList({ todos, onToggle }: TodoListProps) {
  if (todos.length === 0) {
    return <div style={emptyStateStyle}>Start by adding a task above.</div>;
  }

  return (
    <ul style={listStyle}>
      {todos.map((todo) => {
        const done = todo.completed;

        return (
          <li
            key={todo.id}
            style={{
              ...itemStyle,
              color: done ? "#94a3b8" : "#e2e8f0",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
              <input
                checked={done}
                onChange={() => onToggle(todo.id)}
                style={checkboxStyle}
                type="checkbox"
              />
              <span style={{ flex: 1 }}>{todo.text}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
