import "./preview.css";
import { Buffer } from "buffer";

window.Buffer = Buffer;

declare global {
  interface Window {
    __tinyUiBundlerSwReady?: Promise<ServiceWorkerRegistration | null>;
  }
}

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

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const ensureServiceWorkerRegistered = () => {
    if (!window.__tinyUiBundlerSwReady) {
      window.__tinyUiBundlerSwReady = navigator.serviceWorker
        .getRegistration("/tiny-ui-sw.js")
        .then((registration) => registration ?? navigator.serviceWorker.register("/tiny-ui-sw.js"))
        .then(async () => {
          try {
            return await navigator.serviceWorker.ready;
          } catch (readyError) {
            console.warn("[tiny-ui-bundler] Service worker ready promise rejected", readyError);
            return null;
          }
        })
        .catch((error) => {
          console.warn("[tiny-ui-bundler] Failed to register service worker", error);
          return null;
        });
    }
    return window.__tinyUiBundlerSwReady;
  };

  ensureServiceWorkerRegistered()?.catch(() => {
    // Errors are already logged above.
  });
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
