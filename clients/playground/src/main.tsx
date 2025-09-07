import "allotment/dist/style.css";

import { ChakraProvider } from "@chakra-ui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { WorkspaceProvider } from "./state/WorkspaceProvider";
import theme from "./theme/theme";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={theme}>
      <WorkspaceProvider>
        <App />
      </WorkspaceProvider>
    </ChakraProvider>
  </StrictMode>,
);
