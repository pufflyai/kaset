import "allotment/dist/style.css";

import { ChakraProvider } from "@chakra-ui/react";
import { NuqsAdapter } from "nuqs/adapters/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { WorkspaceProvider } from "./state/WorkspaceProvider";
import type { WorkspaceState } from "./state/types";
import theme from "./theme/theme";

const initialWorkspaceState: WorkspaceState = {
  version: "1.0",
  conversations: {
    default: {
      id: "default",
      name: "Conversation 1",
      messages: [],
    },
  },
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={theme}>
      <NuqsAdapter>
        <WorkspaceProvider namespace="playground" initialState={initialWorkspaceState}>
          <App />
        </WorkspaceProvider>
      </NuqsAdapter>
    </ChakraProvider>
  </StrictMode>,
);
