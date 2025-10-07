import { createSpiralAnimation } from "./animations/createSpiral";
import { createPulseBars } from "./animations/createPulseBars";
import { createWaveGrid } from "./animations/createWaveGrid";

const animations = [
  {
    name: "Aurora Spiral",
    description: "Orbiting particles swirl around a shimmering core.",
    run: createSpiralAnimation,
  },
  {
    name: "Chromatic Pulse",
    description: "Audio-inspired bars breathe with layered sine waves.",
    run: createPulseBars,
  },
  {
    name: "Wave Grid",
    description: "A field of nodes reacts to traveling ripple patterns.",
    run: createWaveGrid,
  },
];

export function mount(container) {
  if (!container) return;

  container.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = [
    ".d3-gallery {",
    "  font-family: system-ui, sans-serif;",
    "  color: #e2e8f0;",
    "  background: #020617;",
    "  border-radius: 12px;",
    "  padding: 24px;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 24px;",
    "  min-height: 320px;",
    "  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.55);",
    "}",
    ".d3-gallery__intro {",
    "  max-width: 560px;",
    "}",
    ".d3-gallery__intro h2 {",
    "  margin: 0 0 8px;",
    "  font-size: 1.5rem;",
    "  color: #38bdf8;",
    "}",
    ".d3-gallery__intro p {",
    "  margin: 0;",
    "  color: #94a3b8;",
    "  line-height: 1.4;",
    "}",
    ".d3-gallery__grid {",
    "  display: grid;",
    "  gap: 20px;",
    "  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));",
    "}",
    ".d3-card {",
    "  background: linear-gradient(160deg, rgba(15, 23, 42, 0.92), rgba(14, 165, 233, 0.35));",
    "  border: 1px solid rgba(148, 163, 184, 0.15);",
    "  border-radius: 16px;",
    "  padding: 18px;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 8px;",
    "  overflow: hidden;",
    "  position: relative;",
    "}",
    ".d3-card::after {",
    "  content: '';",
    "  position: absolute;",
    "  inset: 0;",
    "  pointer-events: none;",
    "  background: radial-gradient(circle at top right, rgba(59, 130, 246, 0.25), transparent 55%);",
    "}",
    ".d3-card h3 {",
    "  margin: 0;",
    "  font-size: 1.1rem;",
    "}",
    ".d3-card p {",
    "  margin: 0;",
    "  color: #cbd5f5;",
    "  font-size: 0.9rem;",
    "}",
    ".d3-card__canvas {",
    "  flex: 1;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  min-height: 220px;",
    "  isolation: isolate;",
    "}",
    ".d3-card svg {",
    "  width: 100%;",
    "  height: 100%;",
    "}",
  ].join("\\n");

  const root = document.createElement("div");
  root.className = "d3-gallery";

  container.appendChild(style);
  container.appendChild(root);

  const intro = document.createElement("div");
  intro.className = "d3-gallery__intro";
  intro.innerHTML =
    "<h2>Kaset D3 Gallery</h2>" +
    "<p>Dynamic SVG animations rendered with D3, compiled once and streamed through the Tiny UI iframe runtime.</p>";
  root.appendChild(intro);

  const grid = document.createElement("div");
  grid.className = "d3-gallery__grid";
  root.appendChild(grid);

  const cleanup = [];

  animations.forEach((animation) => {
    const card = document.createElement("article");
    card.className = "d3-card";

    const heading = document.createElement("h3");
    heading.textContent = animation.name;
    card.appendChild(heading);

    const description = document.createElement("p");
    description.textContent = animation.description;
    card.appendChild(description);

    const canvas = document.createElement("div");
    canvas.className = "d3-card__canvas";
    card.appendChild(canvas);

    const stop = animation.run(canvas);
    if (typeof stop === "function") cleanup.push(stop);

    grid.appendChild(card);
  });

  return () => {
    cleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn("Failed to clean up animation", error);
      }
    });

    root.remove();
    style.remove();
  };
}
