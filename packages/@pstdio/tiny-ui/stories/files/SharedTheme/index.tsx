import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ChakraProvider, Box, Button, extendTheme, Text, VStack } from "@chakra-ui/react";

import "./tokens.css";

const theme = extendTheme({
  colors: {
    brand: {
      50: "var(--brand-50, #eef2ff)",
      100: "var(--brand-100, #e0e7ff)",
      500: "var(--brand-500, #6366f1)",
      600: "var(--brand-600, #4f46e5)",
    },
  },
  radii: {
    lg: "var(--radius-lg, 12px)",
  },
});

const App = () => (
  <Box bg="var(--surface, #0f172a)" color="var(--text, #e2e8f0)" p={6} rounded="lg">
    <VStack align="stretch" spacing={4}>
      <Text as="h2" fontSize="xl" fontWeight="bold" m={0}>
        Shared Theme · Chakra UI
      </Text>
      <Text color="var(--muted, #94a3b8)">Tokens come from CSS custom properties shared by the host.</Text>
      <Button colorScheme="brand" size="md">
        Brand Button
      </Button>
    </VStack>
  </Box>
);

export function mount(container: Element | null) {
  if (!container) return;

  container.innerHTML = "";
  const root = createRoot(container);

  root.render(
    <StrictMode>
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </StrictMode>,
  );

  return () => {
    root.unmount();
  };
}
