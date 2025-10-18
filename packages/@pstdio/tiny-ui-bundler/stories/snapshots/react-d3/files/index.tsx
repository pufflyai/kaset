import { createRoot } from "react-dom/client";

import { LatencyChart } from "./chart";
import { latencySeries } from "./data";
import "./styles.css";

export function mountLatencyWidget(target: HTMLElement) {
  const root = createRoot(target);

  root.render(<LatencyChart series={latencySeries} />);

  return root;
}

export function describeLatencyWidget() {
  return __SUMMARY__;
}

console.info("[React + D3 Snapshot]", latencySeries.label, `(${latencySeries.points.length} samples)`);
