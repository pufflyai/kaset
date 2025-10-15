import { ChakraProvider, Flex, Text, defaultSystem } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import { TodoList } from "./component";
import { TodoProvider } from "./state/TodoProvider";
import type { TinyHost } from "./opfs";

interface TodoWindowProps {
  host: TinyHost;
}

function isTinyHost(value: unknown): value is TinyHost {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return "fs" in record;
}

function resolveHost(provided: TinyHost | null | undefined): TinyHost | null {
  if (provided) return provided;
  const fallback = (window as typeof window & { __tinyUiHost__?: unknown }).__tinyUiHost__;
  if (isTinyHost(fallback)) return fallback;
  return null;
}

function TodoWindow({ host }: TodoWindowProps) {
  return (
    <TodoProvider host={host}>
      <TodoList />
    </TodoProvider>
  );
}

function MissingHost() {
  return (
    <Flex align="center" justify="center" height="100%" padding="6">
      <Text fontSize="sm" textAlign="center" color="foreground.subtle">
        Tiny UI host is not available for the Todo plugin.
      </Text>
    </Flex>
  );
}

export function mount(container: Element | null, host?: TinyHost | null) {
  if (!container) throw new Error("todo plugin mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);
  const resolvedHost = resolveHost(host);

  root.render(
    <ChakraProvider value={defaultSystem}>
      {resolvedHost ? <TodoWindow host={resolvedHost} /> : <MissingHost />}
    </ChakraProvider>,
  );

  return () => {
    root.unmount();
  };
}
