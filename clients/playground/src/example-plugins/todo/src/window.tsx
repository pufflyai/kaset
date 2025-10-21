import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import type { TinyUiHost } from "./host";
import { TodoList } from "./component";
import { TodoProvider } from "./state/TodoProvider";

interface TodoWindowProps {
  host: TinyUiHost;
}

function TodoWindow(props: TodoWindowProps) {
  const { host } = props;
  return (
    <TodoProvider host={host}>
      <TodoList />
    </TodoProvider>
  );
}

export function mount(container: Element | null, host?: TinyUiHost | null) {
  if (!container) throw new Error("todo plugin mount target is not available");
  if (!host) throw new Error("todo plugin requires the Tiny UI host bridge");

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);

  root.render(
    <ChakraProvider value={defaultSystem}>
      <TodoWindow host={host} />
    </ChakraProvider>,
  );

  return () => {
    root.unmount();
  };
}
