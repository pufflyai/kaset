import { buildReport } from "./report";
import { loadMetrics } from "./metrics";
import "./styles.css";

const announcement = __ANNOUNCEMENT__;
const metrics = loadMetrics();

export const report = buildReport(metrics);

console.info("[Analytics Snapshot] Summary:", report.summary);

if (typeof document !== "undefined") {
  document.body.dataset.analyticsAnnouncement = announcement;

  let badge = document.querySelector<HTMLElement>("[data-analytics-badge]");
  if (!badge) {
    badge = document.createElement("span");
    badge.dataset.analyticsBadge = "";
    badge.setAttribute("data-analytics-badge", "");
    badge.className = "analytics-badge";
    badge.textContent = __BADGE_FALLBACK__;
    document.body.appendChild(badge);
  }

  badge.textContent = report.badge;
  badge.dataset.severity = report.forecast.severity;
}
