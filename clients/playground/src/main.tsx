import "allotment/dist/style.css";

import { ChakraProvider } from "@chakra-ui/react";
import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TinyUiProvider } from "@pstdio/tiny-ui";
import { App } from "./App";
import { WorkspaceProvider } from "./state/WorkspaceProvider";
import theme from "./theme/theme";

window.Buffer = Buffer; // required by isomorphic-git

const buildAssetUrl = (path: string) => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
};

const serviceWorkerUrl = buildAssetUrl("sw.js");
const runtimeUrl = buildAssetUrl("tiny-ui/runtime.html");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TinyUiProvider serviceWorkerUrl={serviceWorkerUrl} runtimeUrl={runtimeUrl}>
      <ChakraProvider value={theme}>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </ChakraProvider>
    </TinyUiProvider>
  </StrictMode>,
);
