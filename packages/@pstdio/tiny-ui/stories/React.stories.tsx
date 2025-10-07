import type { Meta, StoryObj } from "@storybook/react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { CACHE_NAME } from "../src/constant";
import { setLockfile } from "../src/core/idb";
import { registerVirtualSnapshot } from "../src/core/snapshot";
import type { CompileResult } from "../src/esbuild/types";
import { TinyUI, type TinyUIHandle } from "../src/react/tiny-ui";
import { TinyUIStatus } from "../src/react/types";

const STORY_ROOT = "/stories/tiny-react";
const SOURCE_ID = "tiny-ui-react";
const ZUSTAND_STORY_ROOT = "/stories/tiny-react-zustand";
const ZUSTAND_SOURCE_ID = "tiny-ui-react-zustand";

const LOCKFILE = {
  react: "https://esm.sh/react@19.1.0/es2022/react.mjs",
  "react/jsx-runtime": "https://esm.sh/react@19.1.0/es2022/jsx-runtime.mjs",
  "react-dom/client": "https://esm.sh/react-dom@19.1.0/es2022/client.mjs",
  zustand: "https://esm.sh/zustand@5.0.0/es2022/zustand.mjs",
  "zustand/vanilla": "https://esm.sh/zustand@5.0.0/es2022/vanilla.mjs",
} as const;

const REACT_ENTRY_SOURCE = String.raw`import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { CounterCard } from "./CounterCard";

export function mount(container) {
  if (!container) return;

  container.innerHTML = "";

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <CounterCard />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
`;

const COUNTER_CARD_SOURCE = String.raw`import { useMemo, useState } from "react";

const containerStyle = {
  fontFamily: "system-ui, sans-serif",
  padding: "1.5rem",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "12px",
  maxWidth: "100%",
};

const headingStyle = {
  marginTop: 0,
};

const messageStyle = {
  marginBottom: "1rem",
  color: "#94a3b8",
};

const counterStyle = {
  display: "block",
  fontSize: "2.25rem",
  margin: "0.5rem 0",
};

const buttonsStyle = {
  display: "flex",
  gap: "0.75rem",
  marginTop: "1.25rem",
};

const buttonBaseStyle = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  cursor: "pointer",
};

/**
 * @param {number} value
 */
const getAccentColor = (value) => {
  if (value > 0) return "#22c55e";
  if (value < 0) return "#f97316";
  return "#e2e8f0";
};

export function CounterCard() {
  const [count, setCount] = useState(0);

  const accentColor = useMemo(() => getAccentColor(count), [count]);

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>Kaset React Demo</h2>
      <p style={messageStyle}>React component compiled and cached once under /virtual/*.</p>
      <strong style={{ ...counterStyle, color: accentColor }}>{count}</strong>
      <div style={buttonsStyle}>
        <button
          onClick={() => setCount((value) => value - 1)}
          style={{ ...buttonBaseStyle, background: "#1e293b", color: "#e2e8f0" }}
          type="button"
        >
          Decrease
        </button>
        <button
          onClick={() => setCount((value) => value + 1)}
          style={{ ...buttonBaseStyle, background: "#38bdf8", color: "#0f172a" }}
          type="button"
        >
          Increase
        </button>
      </div>
    </div>
  );
}
`;

const ZUSTAND_ENTRY_SOURCE = String.raw`import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TodoApp } from "./TodoApp";

export function mount(container) {
  if (!container) return;

  container.innerHTML = "";

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <TodoApp />
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
`;

const ZUSTAND_APP_SOURCE = String.raw`import { useMemo } from "react";

import { TodoInput } from "./TodoInput";
import { TodoList } from "./TodoList";
import { TodoStats } from "./TodoStats";
import { useTodoStore } from "./store/useTodoStore";

const containerStyle = {
  fontFamily: "system-ui, sans-serif",
  padding: "1.5rem",
  background: "#0f172a",
  color: "#e2e8f0",
  borderRadius: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "1rem",
};

const contentStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const clearButtonStyle = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  color: "#e2e8f0",
  transition: "background 0.15s ease",
};

export function TodoApp() {
  const todos = useTodoStore((state) => state.todos);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);
  const clearCompleted = useTodoStore((state) => state.clearCompleted);

  const remaining = useMemo(() => todos.filter((item) => !item.completed).length, [todos]);
  const completed = todos.length - remaining;
  const hasCompleted = completed > 0;

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: 0 }}>Kaset Zustand Demo</h2>
      <p style={{ marginTop: 0, color: "#94a3b8" }}>
        Multiple files compiled with esbuild-wasm and wired with Zustand state.
      </p>
      <div style={contentStyle}>
        <TodoInput />
        <TodoList todos={todos} onToggle={toggleTodo} />
      </div>
      <TodoStats remaining={remaining} total={todos.length} />
      <button
        onClick={clearCompleted}
        disabled={!hasCompleted}
        style={{
          ...clearButtonStyle,
          background: hasCompleted ? "#f97316" : "#1e293b",
          cursor: hasCompleted ? "pointer" : "not-allowed",
          opacity: hasCompleted ? 1 : 0.6,
        }}
        type="button"
      >
        Clear completed ({completed})
      </button>
    </div>
  );
}
`;

const ZUSTAND_INPUT_SOURCE = String.raw`import type { FormEvent } from "react";
import { useState } from "react";

import { useTodoStore } from "./store/useTodoStore";

const formStyle = {
  display: "flex",
  gap: "0.5rem",
};

const inputStyle = {
  flex: 1,
  padding: "0.5rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid #1e293b",
  background: "#020617",
  color: "#e2e8f0",
};

const buttonStyle = {
  padding: "0.5rem 1rem",
  borderRadius: "8px",
  border: "none",
  background: "#38bdf8",
  color: "#0f172a",
  cursor: "pointer",
};

export function TodoInput() {
  const [value, setValue] = useState("");
  const addTodo = useTodoStore((state) => state.addTodo);

  const handleSubmit = () => {
    if (!value.trim()) return;
    addTodo(value);
    setValue("");
  };

  return (
    <div style={formStyle}>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Add a note and press enter"
        style={inputStyle}
        type="text"
      />
      <button style={buttonStyle} onClick={handleSubmit}>
        Add
      </button>
    </div>
  );
}
`;

const ZUSTAND_LIST_SOURCE = String.raw`import type { TodoItem } from "./store/useTodoStore";

interface TodoListProps {
  todos: TodoItem[];
  onToggle: (id: string) => void;
}

const listStyle = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  padding: "0.75rem",
  borderRadius: "8px",
  background: "#1e293b",
};

const checkboxStyle = {
  width: "1.2rem",
  height: "1.2rem",
};

const emptyStateStyle = {
  padding: "0.75rem",
  borderRadius: "8px",
  background: "#1e293b",
  color: "#94a3b8",
  textAlign: "center",
};

export function TodoList({ todos, onToggle }: TodoListProps) {
  if (todos.length === 0) {
    return <div style={emptyStateStyle}>Start by adding a task above.</div>;
  }

  return (
    <ul style={listStyle}>
      {todos.map((todo) => {
        const done = todo.completed;

        return (
          <li
            key={todo.id}
            style={{
              ...itemStyle,
              color: done ? "#94a3b8" : "#e2e8f0",
              textDecoration: done ? "line-through" : "none",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", width: "100%" }}>
              <input
                checked={done}
                onChange={() => onToggle(todo.id)}
                style={checkboxStyle}
                type="checkbox"
              />
              <span style={{ flex: 1 }}>{todo.text}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
`;

const ZUSTAND_STATS_SOURCE = String.raw`interface TodoStatsProps {
  remaining: number;
  total: number;
}

const statsStyle = {
  display: "flex",
  gap: "0.5rem",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.75rem",
  borderRadius: "8px",
  background: "#0b1120",
};

const badgeStyle = {
  padding: "0.25rem 0.75rem",
  borderRadius: "999px",
  background: "#1e293b",
  color: "#e2e8f0",
  fontSize: "0.85rem",
};

export function TodoStats({ remaining, total }: TodoStatsProps) {
  const completed = Math.max(0, total - remaining);
  const summary =
    remaining === 0
      ? "All caught up!"
      : String(remaining) + (remaining === 1 ? " item pending" : " items pending");

  return (
    <div style={statsStyle}>
      <span style={badgeStyle}>{total} total</span>
      <span style={badgeStyle}>{completed} done</span>
      <span>{summary}</span>
    </div>
  );
}
`;

const ZUSTAND_STORE_SOURCE = String.raw`import { useRef, useSyncExternalStore } from "react";
import { createStore } from "zustand/vanilla";

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
}

interface TodoState {
  todos: TodoItem[];
  addTodo: (text: string) => void;
  toggleTodo: (id: string) => void;
  clearCompleted: () => void;
}

type Selector<T> = (state: TodoState) => T;

const randomId = () => Math.random().toString(36).slice(2, 10);

const store = createStore<TodoState>((set) => ({
  todos: [
    { id: "welcome", text: "Welcome to Tiny UI", completed: false },
    { id: "bundle", text: "Bundles persist via OPFS cache", completed: true },
  ],
  addTodo(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    set((state) => ({
      ...state,
      todos: [
        ...state.todos,
        { id: randomId(), text: trimmed, completed: false },
      ],
    }));
  },
  toggleTodo(id) {
    set((state) => ({
      ...state,
      todos: state.todos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    }));
  },
  clearCompleted() {
    set((state) => ({
      ...state,
      todos: state.todos.filter((todo) => !todo.completed),
    }));
  },
}));

export const todoStore = store;

export function useTodoStore<T>(selector: Selector<T>) {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  return useSyncExternalStore(
    store.subscribe,
    () => selectorRef.current(store.getState()),
    () => selectorRef.current(store.getState()),
  );
}
`;

registerVirtualSnapshot(STORY_ROOT, {
  entry: "/index.tsx",
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
    "/index.tsx": REACT_ENTRY_SOURCE,
    "/CounterCard.tsx": COUNTER_CARD_SOURCE,
  },
});

registerVirtualSnapshot(ZUSTAND_STORY_ROOT, {
  entry: "/index.tsx",
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
    "/index.tsx": ZUSTAND_ENTRY_SOURCE,
    "/TodoApp.tsx": ZUSTAND_APP_SOURCE,
    "/TodoInput.tsx": ZUSTAND_INPUT_SOURCE,
    "/TodoList.tsx": ZUSTAND_LIST_SOURCE,
    "/TodoStats.tsx": ZUSTAND_STATS_SOURCE,
    "/store/useTodoStore.ts": ZUSTAND_STORE_SOURCE,
  },
});

interface ReactDemoProps {
  autoCompile?: boolean;
  sourceRoot?: string;
  bundleId?: string;
}

const now = () =>
  typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

const ReactDemo = ({ autoCompile = true, sourceRoot = STORY_ROOT, bundleId = SOURCE_ID }: ReactDemoProps) => {
  const uiRef = useRef<TinyUIHandle | null>(null);
  const compileStartedAtRef = useRef<number | null>(null);
  const [status, setStatus] = useState<TinyUIStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    setLockfile(LOCKFILE);
  }, [LOCKFILE]);

  const handleStatusChange = useCallback((next: TinyUIStatus) => {
    setStatus(next);
    if (next === "compiling") {
      compileStartedAtRef.current = now();
      setMessage("Compiling React bundle with esbuild-wasm...");
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 480 }}>
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
        src={sourceRoot}
        id={bundleId}
        autoCompile={autoCompile}
        serviceWorkerUrl="/tiny-ui-sw.js"
        onStatusChange={handleStatusChange}
        onReady={handleReady}
        onError={handleError}
        style={{
          height: 480,
        }}
      />
      <div aria-live="polite">
        <strong>Status:</strong> {status}
        {message ? <div>{message}</div> : null}
      </div>
    </div>
  );
};

const meta: Meta<typeof ReactDemo> = {
  title: "Tiny UI/React",
  component: ReactDemo,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Compiles the React counter demo using esbuild-wasm, publishes it to /virtual/*, and mounts it through the Tiny UI iframe runtime.",
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof ReactDemo>;

export const Playground: Story = {
  args: {
    autoCompile: true,
  },
};

export const ZustandTodo: Story = {
  name: "Zustand Todo",
  args: {
    autoCompile: true,
    sourceRoot: ZUSTAND_STORY_ROOT,
    bundleId: ZUSTAND_SOURCE_ID,
  },
  parameters: {
    docs: {
      description: {
        story: "Compiles a multi-file React workspace that shares state through a Zustand store.",
      },
    },
  },
};
