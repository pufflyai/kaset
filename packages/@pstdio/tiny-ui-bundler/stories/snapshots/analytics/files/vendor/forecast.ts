import type { MetricPoint } from "../metrics";

export interface ForecastResult {
  severity: "low" | "medium" | "high";
  projectedLatency: number;
  projectedThroughput: number;
  projectedErrors: number;
  trends: Array<{
    region: string;
    latencySlope: number;
    throughputSlope: number;
    errorAverage: number;
  }>;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const rollingAverage = (series: number[], windowSize: number) => {
  const slice = series.slice(-windowSize);
  if (slice.length === 0) return 0;

  return slice.reduce((total, value) => total + value, 0) / slice.length;
};

const linearRegressionSlope = (series: number[]) => {
  const count = series.length;
  if (count <= 1) return 0;

  const xValues = Array.from({ length: count }, (_, index) => index);
  const xMean = xValues.reduce((total, value) => total + value, 0) / count;
  const yMean = series.reduce((total, value) => total + value, 0) / count;

  let numerator = 0;
  let denominator = 0;

  for (let index = 0; index < count; index += 1) {
    const x = xValues[index];
    const y = series[index];
    numerator += (x - xMean) * (y - yMean);
    denominator += (x - xMean) ** 2;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
};

const classifySeverity = (latency: number, errors: number, throughputSlope: number) => {
  if (latency > 350 || errors > 20) return "high";
  if (latency > 280 || errors > 12 || throughputSlope < -80) return "medium";
  return "low";
};

const flatten = (metrics: MetricPoint[], key: keyof MetricPoint) => metrics.flatMap((entry) => entry[key] as number[]);

export const buildForecast = (metrics: MetricPoint[], windowSize: number): ForecastResult => {
  const combinedLatency = flatten(metrics, "latency");
  const combinedThroughput = flatten(metrics, "throughput");
  const combinedErrors = flatten(metrics, "errors");

  const latencySlope = linearRegressionSlope(combinedLatency.slice(-windowSize));
  const throughputSlope = linearRegressionSlope(combinedThroughput.slice(-windowSize));
  const errorAverage = rollingAverage(combinedErrors, windowSize);

  const projectedLatency = combinedLatency.at(-1)! + latencySlope * 2;
  const projectedThroughput = combinedThroughput.at(-1)! + throughputSlope * 2;
  const projectedErrors = clamp(errorAverage * 1.1, 0, 100);

  const severity = classifySeverity(projectedLatency, projectedErrors, throughputSlope);

  const trends = metrics.map((entry) => ({
    region: entry.region,
    latencySlope: linearRegressionSlope(entry.latency.slice(-windowSize)),
    throughputSlope: linearRegressionSlope(entry.throughput.slice(-windowSize)),
    errorAverage: rollingAverage(entry.errors, windowSize),
  }));

  return {
    severity,
    projectedLatency: Math.round(projectedLatency),
    projectedThroughput: Math.round(projectedThroughput),
    projectedErrors: Number(projectedErrors.toFixed(2)),
    trends,
  };
};
