import type { CSSProperties } from "react";

interface TodoStatsProps {
  remaining: number;
  total: number;
}

const statsStyle: CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.75rem",
  borderRadius: "8px",
  background: "#0b1120",
};

const badgeStyle: CSSProperties = {
  padding: "0.25rem 0.75rem",
  borderRadius: "999px",
  background: "#1e293b",
  color: "#e2e8f0",
  fontSize: "0.85rem",
};

export function TodoStats({ remaining, total }: TodoStatsProps) {
  const completed = Math.max(0, total - remaining);
  const summary = remaining === 0 ? "All caught up!" : `${remaining} ${remaining === 1 ? "item" : "items"} pending`;

  return (
    <div style={statsStyle}>
      <span style={badgeStyle}>{total} total</span>
      <span style={badgeStyle}>{completed} done</span>
      <span>{summary}</span>
    </div>
  );
}
