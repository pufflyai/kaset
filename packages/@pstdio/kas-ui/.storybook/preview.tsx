import type { Preview } from "@storybook/react";
import { ChakraProvider, PortalManager } from "@chakra-ui/react";
import { KasUIProvider } from "../src/state/KasUIProvider";
import theme from "./theme";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <ChakraProvider theme={theme}>
        <KasUIProvider>
          <PortalManager>
            <Story />
          </PortalManager>
        </KasUIProvider>
      </ChakraProvider>
    ),
  ],
};

export default preview;
