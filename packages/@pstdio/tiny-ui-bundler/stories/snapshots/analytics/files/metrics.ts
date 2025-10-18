export interface MetricPoint {
  region: string;
  latency: number[];
  errors: number[];
  throughput: number[];
}

const RAW_METRICS: MetricPoint[] = __DATA__;

export const loadMetrics = () =>
  RAW_METRICS.map((entry) => ({
    ...entry,
    latency: [...entry.latency],
    errors: [...entry.errors],
    throughput: [...entry.throughput],
  }));
