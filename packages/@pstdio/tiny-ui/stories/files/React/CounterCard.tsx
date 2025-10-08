import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

const containerStyle: CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  padding: "1.5rem",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "12px",
  maxWidth: "100%",
};

const headingStyle: CSSProperties = {
  marginTop: 0,
};

const messageStyle: CSSProperties = {
  marginBottom: "1rem",
  color: "#94a3b8",
};

const counterStyle: CSSProperties = {
  display: "block",
  fontSize: "2.25rem",
  margin: "0.5rem 0",
};

const buttonsStyle: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  marginTop: "1.25rem",
};

const buttonBaseStyle: CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
};

const getAccentColor = (value: number) => {
  if (value > 0) return "#22c55e";
  if (value < 0) return "#f97316";
  return "#e2e8f0";
};

export function CounterCard() {
  const [count, setCount] = useState(0);

  const accentColor = useMemo(() => getAccentColor(count), [count]);

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Kaset React Demo</h2>
      <p style={messageStyle}>React component compiled and cached once under /virtual/*.</p>
      <strong style={{ ...counterStyle, color: accentColor }}>{count}</strong>
      <div style={buttonsStyle}>
        <button
          onClick={() => setCount((value) => value - 1)}
          style={{ ...buttonBaseStyle, background: "#1e293b", color: "#e2e8f0" }}
          type="button"
        >
          Decrease
        </button>
        <button
          onClick={() => setCount((value) => value + 1)}
          style={{ ...buttonBaseStyle, background: "#38bdf8", color: "#0f172a" }}
          type="button"
        >
          Increase
        </button>
      </div>
    </div>
  );
}
