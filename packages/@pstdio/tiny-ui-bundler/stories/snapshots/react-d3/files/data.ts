export interface LatencyPoint {
  timestamp: string;
  value: number;
}

export interface LatencySeries {
  label: string;
  accent: string;
  annotation: string;
  width: number;
  height: number;
  points: LatencyPoint[];
}

export const latencySeries: LatencySeries = {
  label: __LABEL__,
  accent: __ACCENT__,
  annotation: __ANNOTATION__,
  width: 360,
  height: 200,
  points: __POINTS__,
};
