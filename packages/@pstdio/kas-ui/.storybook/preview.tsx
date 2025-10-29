import { ChakraProvider } from "@chakra-ui/react";
import type { Preview } from "@storybook/react";
import { KasUIProvider } from "../src/state/KasUIProvider";
import system from "./theme";

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
      <ChakraProvider value={system}>
        <KasUIProvider>
          <Story />
        </KasUIProvider>
      </ChakraProvider>
    ),
  ],
};

export default preview;
