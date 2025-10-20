import type { MetricPoint } from "./metrics";
import { buildForecast } from "./vendor/forecast";
import { toReportSummary } from "./vendor/format";

const BADGE_PREFIX = __BADGE_PREFIX__;
const WINDOW_SIZE = __WINDOW__;

export const buildReport = (metrics: MetricPoint[]) => {
  const forecast = buildForecast(metrics, WINDOW_SIZE);
  return toReportSummary(metrics, forecast, BADGE_PREFIX);
};
