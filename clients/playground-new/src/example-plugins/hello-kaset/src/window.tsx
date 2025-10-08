import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

interface HelloWorldAppProps {
  title: string;
  subtitle: string;
}

function HelloWorldApp(props: HelloWorldAppProps) {
  const { title, subtitle } = props;

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
      <strong style={{ fontSize: "1.5rem" }}>{title}</strong>
      <span>{subtitle}</span>
    </div>
  );
}

interface MountOptions {
  title?: string;
  subtitle?: string;
}

export function mount(container: Element | null, _context?: unknown, options: MountOptions = {}) {
  if (!container) throw new Error("Hello World plugin mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";

  const root = createRoot(target);

  const title = options.title ?? "<Hello Kaset>";

  const subtitle = options.subtitle ?? "<This is a blank plugin. Ask Kas to modify and extend it.>";

  root.render(
    <StrictMode>
      <HelloWorldApp title={title} subtitle={subtitle} />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}

export default HelloWorldApp;
