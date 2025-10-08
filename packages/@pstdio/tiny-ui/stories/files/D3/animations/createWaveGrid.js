import { select } from "d3-selection";
import { range } from "d3-array";
import { timer } from "d3-timer";

export function createWaveGrid(container) {
  const size = 280;
  const svg = select(container)
    .append("svg")
    .attr("viewBox", "0 0 " + size + " " + size)
    .attr("aria-label", "Wave grid animation");

  const g = svg.append("g").attr("transform", "translate(" + size / 2 + ", " + size / 2 + ")");

  const rows = 11;
  const cols = 11;
  const spacing = size / Math.max(rows, cols);

  const nodes = range(rows * cols).map((index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return {
      row,
      col,
      x: (col - (cols - 1) / 2) * spacing * 0.78,
      y: (row - (rows - 1) / 2) * spacing * 0.78,
    };
  });

  const circles = g
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", 5)
    .attr("fill", "hsl(260, 85%, 70%)")
    .attr("opacity", 0.8);

  const ripple = timer((elapsed) => {
    const time = elapsed / 850;

    circles
      .attr("cx", function (d) {
        const offset = Math.sin(time + d.row * 0.45 + d.col * 0.25) * 14;
        return d.x + offset;
      })
      .attr("cy", function (d) {
        const offset = Math.cos(time * 0.9 + d.row * 0.32 + d.col * 0.4) * 14;
        return d.y + offset;
      })
      .attr("r", function (d) {
        const scale = Math.sin(time * 1.4 + d.row * 0.4 + d.col * 0.5);
        return 3.5 + Math.abs(scale) * 6;
      })
      .attr("fill", function (d) {
        const hue = (280 + (d.row + d.col) * 8 + Math.sin(time + d.row * 0.3) * 60) % 360;
        const saturation = 75 + Math.sin(time * 0.8 + d.col * 0.4) * 18;
        const lightness = 60 + Math.cos(time + d.row * 0.5) * 10;
        return "hsl(" + hue + ", " + saturation + "%, " + lightness + "%)";
      })
      .attr("opacity", function (d) {
        return 0.35 + Math.abs(Math.sin(time * 0.9 + (d.row + d.col) * 0.12)) * 0.65;
      });
  });

  return () => {
    ripple.stop();
    svg.remove();
  };
}
