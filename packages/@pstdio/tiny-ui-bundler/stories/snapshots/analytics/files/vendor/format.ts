import type { MetricPoint } from "../metrics";
import type { ForecastResult } from "./forecast";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const rateFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 2,
});

const severityLabels: Record<ForecastResult["severity"], string> = {
  low: "Stable",
  medium: "Watch",
  high: "Intervene",
};

const formatRegionTrend = (region: string, trend: number) => {
  if (trend === 0) return `${region}: flat`;
  const direction = trend > 0 ? "rising" : "falling";
  return `${region}: ${direction} ${Math.abs(trend).toFixed(1)}`;
};

export interface AnalyticsReport {
  summary: string;
  badge: string;
  badgePrefix: string;
  forecast: ForecastResult;
  details: string[];
}

export const toReportSummary = (
  metrics: MetricPoint[],
  forecast: ForecastResult,
  badgePrefix: string,
): AnalyticsReport => {
  const averageThroughput =
    metrics.reduce((total, entry) => total + entry.throughput.at(-1)! || 0, 0) / metrics.length || 0;

  const summary = [
    `${severityLabels[forecast.severity]} response`,
    `latency ~${numberFormatter.format(forecast.projectedLatency)}ms`,
    `throughput ~${numberFormatter.format(forecast.projectedThroughput)} r/s`,
    `errors ${rateFormatter.format(forecast.projectedErrors / 100)}`,
  ].join(" · ");

  const details = forecast.trends.map((trend) => formatRegionTrend(trend.region, trend.latencySlope));

  return {
    summary,
    badge: `${badgePrefix} · ${severityLabels[forecast.severity]}`,
    badgePrefix,
    forecast,
    details: [
      ...details,
      `Avg throughput: ${numberFormatter.format(averageThroughput)} r/s`,
      `Projected error budget impact: ${forecast.projectedErrors.toFixed(1)} pts`,
    ],
  };
};
