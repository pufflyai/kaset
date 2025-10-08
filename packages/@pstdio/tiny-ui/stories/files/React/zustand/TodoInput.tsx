import type { ChangeEvent, CSSProperties, KeyboardEvent } from "react";
import { useCallback, useState } from "react";

import { useTodoStore } from "./store/useTodoStore";

const formStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: "0.5rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid #1e293b",
  background: "#020617",
  color: "#e2e8f0",
};

const buttonStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  background: "#38bdf8",
  color: "#0f172a",
  cursor: "pointer",
};

export function TodoInput() {
  const [value, setValue] = useState("");
  const addTodo = useTodoStore((state) => state.addTodo);

  const handleSubmit = useCallback(() => {
    if (!value.trim()) return;
    addTodo(value);
    setValue("");
  }, [addTodo, value]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div style={formStyle}>
      <input
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Add a note and press enter"
        style={inputStyle}
        type="text"
      />
      <button onClick={handleSubmit} style={buttonStyle} type="button">
        Add
      </button>
    </div>
  );
}
