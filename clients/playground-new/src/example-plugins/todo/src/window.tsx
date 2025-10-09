import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { createRoot } from "react-dom/client";
import { TodoList } from "./component";
import { TodoProvider } from "./state/TodoProvider";

function TodoWindow() {
  return (
    <TodoProvider>
      <TodoList />
    </TodoProvider>
  );
}

export function mount(container: Element | null) {
  if (!container) throw new Error("todo plugin mount target is not available");

  const target = container as HTMLElement;
  target.innerHTML = "";
  const root = createRoot(target);

  root.render(
    <ChakraProvider value={defaultSystem}>
      <TodoWindow />
    </ChakraProvider>,
  );

  return () => {
    root.unmount();
  };
}
