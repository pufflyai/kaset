import { select } from "d3-selection";
import { range } from "d3-array";
import { timer } from "d3-timer";

export function createPulseBars(container) {
  const width = 320;
  const height = 220;
  const svg = select(container)
    .append("svg")
    .attr("viewBox", "0 0 " + width + " " + height)
    .attr("aria-label", "Pulse bars animation");

  const margin = { top: 16, right: 16, bottom: 16, left: 16 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g").attr("transform", "translate(" + margin.left + ", " + margin.top + ")");

  const count = 28;
  const xStep = innerWidth / count;

  const bars = g
    .selectAll("rect")
    .data(range(count))
    .enter()
    .append("rect")
    .attr("x", function (_, index) {
      return index * xStep + xStep * 0.1;
    })
    .attr("width", xStep * 0.8)
    .attr("rx", 6)
    .attr("ry", 6)
    .attr("fill", "hsl(195, 90%, 65%)")
    .attr("opacity", 0.75)
    .attr("y", innerHeight - 32)
    .attr("height", 32);

  g.append("line")
    .attr("x1", 0)
    .attr("x2", innerWidth)
    .attr("y1", innerHeight)
    .attr("y2", innerHeight)
    .attr("stroke-width", 1.5)
    .attr("stroke", "rgba(226, 232, 240, 0.35)");

  const glow = timer((elapsed) => {
    const time = elapsed / 1000;

    bars
      .attr("y", function (_, index) {
        const wave = Math.sin(time * 2 + index * 0.32) + Math.cos(time * 1.4 + index * 0.45);
        const normalized = (wave + 2) / 4;
        const barHeight = 28 + normalized * (innerHeight - 36);
        return innerHeight - barHeight;
      })
      .attr("height", function (_, index) {
        const wave = Math.sin(time * 2 + index * 0.32) + Math.cos(time * 1.4 + index * 0.45);
        const normalized = (wave + 2) / 4;
        return 28 + normalized * (innerHeight - 36);
      })
      .attr("fill", function (_, index) {
        const hue = (188 + Math.sin(time + index * 0.18) * 40 + 360) % 360;
        const light = 55 + Math.sin(time * 1.5 + index * 0.28) * 14;
        return "hsl(" + hue + ", 85%, " + light + "%)";
      })
      .attr("opacity", function (_, index) {
        return 0.55 + Math.abs(Math.sin(time * 1.2 + index * 0.24)) * 0.45;
      });
  });

  return () => {
    glow.stop();
    svg.remove();
  };
}
