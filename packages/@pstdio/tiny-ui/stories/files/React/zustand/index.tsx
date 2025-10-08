import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TodoApp } from "./TodoApp";

export function mount(container: Element | null) {
  if (!container) return;

  container.innerHTML = "";

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <TodoApp />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
