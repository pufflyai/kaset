import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CounterCard } from "./CounterCard";

export function mount(container: Element | null) {
  if (!container) return;

  container.innerHTML = "";

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <CounterCard />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
