import "allotment/dist/style.css";

import { ChakraProvider } from "@chakra-ui/react";
import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Desktop } from "./components/ui/desktop";
import { WorkspaceProvider } from "./state/WorkspaceProvider";
import theme from "./theme/theme";

window.Buffer = Buffer; // required by isomorphic-git

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ChakraProvider value={theme}>
      <WorkspaceProvider>
        <Desktop />
      </WorkspaceProvider>
    </ChakraProvider>
  </StrictMode>,
);
