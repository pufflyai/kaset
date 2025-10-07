import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME } from "../src/constant.js";
import { setLockfile } from "../src/core/idb.js";
import { registerVirtualSnapshot } from "../src/core/snapshot.js";
import type { CompileResult } from "../src/esbuild/types.js";
import { TinyUI, type TinyUIHandle, type TinyUIStatus } from "../src/react/tiny-ui.js";

const STORY_ROOT = "/stories/tiny-vanilla";
const SOURCE_ID = "tiny-ui-vanilla";

const VANILLA_ENTRY_SOURCE = String.raw`export function mount(container) {
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
`;

registerVirtualSnapshot(STORY_ROOT, {
  entry: "/index.js",
  tsconfig: JSON.stringify(
    {
      compilerOptions: {
        jsx: "react-jsx",
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
      },
    },
    null,
    2,
  ),
  files: {
    "/index.js": VANILLA_ENTRY_SOURCE,
  },
});

interface VanillaDemoProps {
  autoCompile?: boolean;
}

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const VanillaDemo = ({ autoCompile = true }: VanillaDemoProps) => {
  const uiRef = useRef<TinyUIHandle | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    setLockfile(null);
  }, []);

  const handleStatusChange = useCallback((next: TinyUIStatus) => {
    setStatus(next);
    if (next === "compiling") {
      compileStartedAtRef.current = now();
      setMessage("Compiling bundle with esbuild-wasm...");
    }
  }, []);

  const handleReady = useCallback((result: CompileResult) => {
    const startedAt = compileStartedAtRef.current;
    compileStartedAtRef.current = null;

    const duration = typeof startedAt === "number" ? Math.max(0, Math.round(now() - startedAt)) : null;
    const timingLabel = duration !== null ? ` in ${duration}ms` : "";
    const cacheLabel = result.fromCache ? " (from cache)" : "";

    setMessage(`Bundle ready${timingLabel}${cacheLabel}.`);
  }, []);

  const handleError = useCallback((error: Error) => {
    compileStartedAtRef.current = null;
    setStatus("error");
    setMessage(error.message);
  }, []);

  const handleRebuild = useCallback(() => {
    uiRef.current?.rebuild().catch((error) => {
      const normalized = error instanceof Error ? error : new Error("Failed to rebuild bundle");
      setStatus("error");
      setMessage(normalized.message);
    });
  }, []);

  const handleClearCache = useCallback(async () => {
    if (typeof caches === "undefined") return;

    compileStartedAtRef.current = null;

    try {
      setMessage("Clearing bundle cache...");
      await caches.delete(CACHE_NAME);
      setStatus("idle");
      setMessage("Cache cleared. Rebuild to compile again.");
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Failed to clear cache");
      setStatus("error");
      setMessage(normalized.message);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 480 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={status === "compiling"} onClick={handleRebuild} type="button">
          {status === "compiling" ? "Compiling..." : "Rebuild"}
        </button>
        <button onClick={handleClearCache} type="button">
          Clear Cache
        </button>
      </div>
      <TinyUI
        ref={uiRef}
        src={STORY_ROOT}
        id={SOURCE_ID}
        autoCompile={autoCompile}
        onStatusChange={handleStatusChange}
        onReady={handleReady}
        onError={handleError}
        showStatus={false}
        style={{
          width: "100%",
          minHeight: 320,
          background: "#020617",
          borderRadius: 12,
          padding: 16,
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          overflow: "hidden",
        }}
      />
      <div aria-live="polite">
        <strong>Status:</strong> {status}
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
};

const meta: Meta<typeof VanillaDemo> = {
  title: "Tiny UI/Vanilla",
  component: VanillaDemo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compiles a vanilla counter demo, caches it under /virtual/*, and mounts it through the Tiny UI iframe runtime.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof VanillaDemo>;

export const Playground: Story = {
  args: {
    autoCompile: true,
  },
};
