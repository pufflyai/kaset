import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

interface HelloWorldAppProps {
  greeting: string;
  recipient: string;
}

function HelloWorldApp(props: HelloWorldAppProps) {
  const { greeting, recipient } = props;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        background: "linear-gradient(135deg, #0f172a, #1e293b)",
        color: "#e2e8f0",
      }}
    >
      <strong style={{ fontSize: "1.5rem" }}>{greeting}</strong>
      <span>{recipient}</span>
      <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>Rendered with @pstdio/tiny-ui</span>
    </div>
  );
}

interface MountOptions {
  greeting?: string;
  recipient?: string;
}

export function mount(container: Element | null, _context?: unknown, options: MountOptions = {}) {
  if (!container) throw new Error("Hello World plugin mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";

  const root = createRoot(target);

  const greeting = options.greeting ?? "Hello";
  const recipient = options.recipient ?? "Kaset";

  root.render(
    <StrictMode>
      <HelloWorldApp greeting={greeting} recipient={recipient} />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}

export default HelloWorldApp;
