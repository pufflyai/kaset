import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { NotepadApp } from "./NotepadApp";

export function mount(container: Element | null) {
  if (!container) return;

  container.innerHTML = "";

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <NotepadApp />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
