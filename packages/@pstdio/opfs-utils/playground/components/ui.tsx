import React, { useState } from "react";

export function Section(props: {
  title: string | React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  const { title, children, defaultOpen = true, collapsible = true } = props;

  const [open, setOpen] = useState<boolean>(defaultOpen);

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: open ? 8 : 0,
          userSelect: "none",
        }}
      >
        {collapsible ? (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={typeof title === "string" ? `${open ? "Collapse" : "Expand"} ${title}` : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              background: "#f9fafb",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 12, lineHeight: 1 }}>{open ? "▼" : "▶"}</span>
          </button>
        ) : null}

        <div style={{ fontWeight: 600 }}>{title}</div>
      </div>

      {open ? <div>{children}</div> : null}
    </section>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 12, color: "#555", marginBottom: 6 }}>{children}</label>;
}

export function Row({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  return <div style={{ display: "flex", gap, alignItems: "center", flexWrap: "wrap" }}>{children}</div>;
}

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; width?: number | string },
) {
  const { label, width = 240, style, ...rest } = props;
  return (
    <div style={{ minWidth: typeof width === "number" ? width : undefined }}>
      {label ? <Label>{label}</Label> : null}
      <input
        {...rest}
        style={{
          width,
          padding: "6px 8px",
          border: "1px solid #ccc",
          borderRadius: 6,
          fontFamily: "var(--font-body, ui-sans-serif, system-ui)",
          ...style,
        }}
      />
    </div>
  );
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    width?: number | string;
    height?: number;
  },
) {
  const { label, width = "100%", height = 160, style, ...rest } = props;
  return (
    <div>
      {label ? <Label>{label}</Label> : null}
      <textarea
        {...rest}
        style={{
          width,
          height,
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 6,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 12,
          whiteSpace: "pre",
          ...style,
        }}
      />
    </div>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" }) {
  const { tone = "default", style, children, ...rest } = props;
  const colors =
    tone === "danger"
      ? { bg: "#fee2e2", br: "#fca5a5", fg: "#991b1b" }
      : { bg: "#eef2ff", br: "#c7d2fe", fg: "#3730a3" };

  return (
    <button
      {...rest}
      style={{
        padding: "6px 10px",
        borderRadius: 6,
        border: `1px solid ${colors.br}`,
        background: colors.bg,
        color: colors.fg,
        cursor: "pointer",
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function MonoBlock({ children, height = 200 }: { children: React.ReactNode; height?: number }) {
  return (
    <pre
      style={{
        background: "#0b1021",
        color: "#e5e7eb",
        padding: 12,
        borderRadius: 8,
        overflow: "auto",
        maxHeight: height,
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      {children}
    </pre>
  );
}
