import "./preview.css";
import { Buffer } from "buffer";

window.Buffer = Buffer;

// Storybook runs without COOP/COEP headers by default, so SharedArrayBuffer
// is typically unavailable. @zenfs/dom references SharedArrayBuffer in a type
// check, which throws a ReferenceError if it's undefined. Provide a minimal
// polyfill to avoid the crash in the playground stories.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {}
  }
}

if (typeof window !== "undefined" && typeof (window as any).SharedArrayBuffer === "undefined") {
  (window as any).SharedArrayBuffer = ArrayBuffer as unknown as SharedArrayBufferConstructor;
}

import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    withThemeByClassName({
      defaultTheme: "light",
      themes: { light: "", dark: "dark" },
    }),
  ],
};

export default preview;
