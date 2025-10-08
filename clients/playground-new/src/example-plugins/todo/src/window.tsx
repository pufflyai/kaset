import { TodoList } from "./component";
import { TodoProvider } from "./state/TodoProvider";

export default function TodoWindow() {
  return (
    <TodoProvider>
      <TodoList />
    </TodoProvider>
  );
}
