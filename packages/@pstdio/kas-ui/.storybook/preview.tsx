import { ChakraProvider } from "@chakra-ui/react";
import type { Preview } from "@storybook/react";
import { KasUIProvider } from "../src/state/KasUIProvider";
import system from "./theme";
import { Global, css } from "@emotion/react";

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
        <Global
          styles={css`
            html,
            body,
            #storybook-root {
              height: 100%;
            }

            body {
              margin: 0;
            }
          `}
        />
        <KasUIProvider>
          <Story />
        </KasUIProvider>
      </ChakraProvider>
    ),
  ],
};

export default preview;
