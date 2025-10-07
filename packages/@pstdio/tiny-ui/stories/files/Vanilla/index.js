export function mount(container) {
  if (!container) return;

  const element = document.createElement("div");
  element.style.fontFamily = "system-ui, sans-serif";
  element.style.padding = "1.5rem";
  element.style.background = "#0f172a";
  element.style.color = "#e2e8f0";
  element.style.borderRadius = "12px";
  element.style.width = "320px";

  const heading = document.createElement("h2");
  heading.textContent = "Kaset Vanilla Demo";
  heading.style.marginTop = "0";

  const copy = document.createElement("p");
  copy.textContent = "No external deps. Bundled once and cached under /virtual/*.";
  copy.style.marginBottom = "1rem";
  copy.style.color = "#94a3b8";

  const counterValue = document.createElement("strong");
  counterValue.style.display = "block";
  counterValue.style.fontSize = "2.25rem";
  counterValue.style.margin = "0.5rem 0";
  counterValue.textContent = "0";

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.gap = "0.75rem";
  buttons.style.marginTop = "1.25rem";

  const makeButton = (label, background, color, handler) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.padding = "0.5rem 1rem";
    button.style.borderRadius = "8px";
    button.style.border = "none";
    button.style.background = background;
    button.style.color = color;
    button.style.cursor = "pointer";
    button.addEventListener("click", handler);
    return button;
  };

  let count = 0;
  const updateCount = () => {
    counterValue.textContent = String(count);
    counterValue.style.color = count > 0 ? "#22c55e" : count < 0 ? "#f97316" : "#e2e8f0";
  };

  buttons.appendChild(
    makeButton("Decrease", "#1e293b", "#e2e8f0", () => {
      count -= 1;
      updateCount();
    }),
  );

  buttons.appendChild(
    makeButton("Increase", "#38bdf8", "#0f172a", () => {
      count += 1;
      updateCount();
    }),
  );

  updateCount();

  element.appendChild(heading);
  element.appendChild(copy);
  element.appendChild(counterValue);
  element.appendChild(buttons);

  container.innerHTML = "";
  container.appendChild(element);
}
