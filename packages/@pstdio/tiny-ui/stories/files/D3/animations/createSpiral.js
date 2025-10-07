import { select } from "d3-selection";
import { range } from "d3-array";
import { timer } from "d3-timer";

const TAU = Math.PI * 2;

export function createSpiralAnimation(container) {
  const size = 280;
  const svg = select(container)
    .append("svg")
    .attr("viewBox", "0 0 " + size + " " + size)
    .attr("aria-label", "Spiral orbit animation");

  const g = svg.append("g").attr("transform", "translate(" + size / 2 + ", " + size / 2 + ")");

  const points = range(120).map((index) => {
    return {
      angle: (index / 120) * 6 * TAU,
      radius: 18 + index * 1.1,
    };
  });

  const circles = g
    .selectAll("circle")
    .data(points)
    .enter()
    .append("circle")
    .attr("r", 6)
    .attr("fill", "hsl(200, 80%, 65%)")
    .attr("opacity", 0.8);

  const spin = timer((elapsed) => {
    const time = elapsed / 900;
    const wobble = 22 * Math.sin(time * 0.9);

    circles
      .attr("cx", (d, index) => {
        const wave = d.radius + wobble * Math.sin(time + index * 0.06);
        return Math.cos(d.angle + time * 1.7) * wave;
      })
      .attr("cy", (d, index) => {
        const wave = d.radius + wobble * Math.cos(time + index * 0.05);
        return Math.sin(d.angle + time * 1.7) * wave;
      })
      .attr("r", (_, index) => 4.8 + Math.sin(time * 2.1 + index * 0.18) * 1.6)
      .attr("fill", (_, index) => {
        const hue = (210 + index * 3 + time * 70) % 360;
        const light = 55 + Math.sin(time + index * 0.2) * 12;
        return "hsl(" + hue + ", 85%, " + light + "%)";
      })
      .attr("opacity", (_, index) => 0.45 + Math.abs(Math.sin(time + index * 0.08)) * 0.55);

    g.attr("transform", "translate(" + size / 2 + ", " + size / 2 + ") rotate(" + time * 24 + ")");
  });

  return () => {
    spin.stop();
    svg.remove();
  };
}