import { useMemo } from "react";
import { scaleLinear } from "d3-scale";
import { curveMonotoneX, line } from "d3-shape";

import type { LatencyPoint, LatencySeries } from "./data";

const PADDING = {
  top: 16,
  right: 12,
  bottom: 20,
  left: 12,
} as const;

const createLatencyShape = (series: LatencySeries) => {
  const count = Math.max(series.points.length - 1, 1);

  const xScale = scaleLinear()
    .domain([0, count])
    .range([PADDING.left, series.width - PADDING.right]);

  const values = series.points.map((point) => point.value);
  const safeValues = values.length > 0 ? values : [0];

  const minValue = Math.min(...safeValues);
  const maxValue = Math.max(...safeValues);

  const yScale = scaleLinear()
    .domain([minValue, maxValue])
    .range([series.height - PADDING.bottom, PADDING.top]);

  const generator = line<LatencyPoint>()
    .x((point, index) => xScale(index))
    .y((point) => yScale(point.value))
    .curve(curveMonotoneX);

  const path = generator(series.points) ?? "";
  const average = Math.round(safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length);

  return {
    path,
    minValue,
    maxValue,
    average,
  };
};

export interface LatencyChartProps {
  series: LatencySeries;
}

export const LatencyChart = ({ series }: LatencyChartProps) => {
  const metrics = useMemo(() => createLatencyShape(series), [series]);
  const accentStyle = useMemo(() => ({ color: series.accent }), [series.accent]);

  return (
    <figure className="latency-chart">
      <figcaption>
        <strong style={accentStyle}>{series.label}</strong>
        <span>{series.annotation}</span>
      </figcaption>

      <svg
        aria-label={`${series.label} latency. Baseline ${metrics.average}ms, range ${metrics.minValue}-${metrics.maxValue}ms.`}
        role="img"
        viewBox={`0 0 ${series.width} ${series.height}`}
      >
        <path d={metrics.path} stroke={series.accent} />
      </svg>

      <dl className="latency-chart__metrics">
        <div>
          <dt>Slowest</dt>
          <dd>{metrics.maxValue} ms</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd>{metrics.average} ms</dd>
        </div>
        <div>
          <dt>Fastest</dt>
          <dd>{metrics.minValue} ms</dd>
        </div>
      </dl>
    </figure>
  );
};
