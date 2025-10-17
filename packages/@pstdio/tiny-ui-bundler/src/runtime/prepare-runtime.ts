/**
 * Prepares Tiny UI runtime assets so hosts can initialise the iframe even when
 * the service worker is bypassed. Consumers call `prepareRuntimeAssets(compileResult)`
 * and receive a module URL plus style metadata that always resolve: the helper
 * materialises blob URLs for the entry chunk, flattens CSS into inline <style>
 * descriptors, and keeps the virtual fetch fallback active.
 *
 * Typical usage:
 *   const prepared = await prepareRuntimeAssets(result);
 *   host.init({ moduleUrl: prepared.moduleUrl, styles: prepared.styles, inlineStyles: prepared.inlineStyles });
 *   // When tearing down:
 *   prepared.cleanup();
 */
import { ensureVirtualFetchFallback, isServiceWorkerControlled } from "./fetch-fallback";
import { getVirtualPrefix } from "../constants";
import type { CompileResult } from "../types";

export interface InlineStyleEntry {
  id: string;
  cssText: string;
}

export interface PreparedRuntimeAssets {
  moduleUrl: string;
  styles: string[];
  inlineStyles: InlineStyleEntry[];
  cleanup(): void;
}

const createNoopCleanup = () => () => {};

const createBlobUrl = (source: string) => {
  const blob = new Blob([source], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const revoke = () => {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.warn("[Tiny UI Bundler] Failed to revoke fallback module URL", error);
    }
  };
  return { url, revoke };
};

const readText = async (url: string) => {
  try {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url} (${response.status} ${response.statusText})`);
    }
    return await response.text();
  } catch (error) {
    console.warn("[Tiny UI Bundler] Failed to load cached asset", url, error);
    return null;
  }
};

export const prepareRuntimeAssets = async (result: CompileResult): Promise<PreparedRuntimeAssets> => {
  ensureVirtualFetchFallback();

  const virtualPrefix = getVirtualPrefix();
  const assetUrls = (result.assets ?? []).map((asset) => `${virtualPrefix}${result.hash}/${asset}`);
  const inlineStyles: InlineStyleEntry[] = [];

  if (isServiceWorkerControlled()) {
    return {
      moduleUrl: result.url,
      styles: assetUrls,
      inlineStyles,
      cleanup: createNoopCleanup(),
    };
  }

  let moduleUrl = result.url;
  let cleanup = createNoopCleanup();

  const entrySource = await readText(result.url);
  if (entrySource) {
    const { url, revoke } = createBlobUrl(entrySource);
    moduleUrl = url;
    cleanup = revoke;
  }

  for (const assetUrl of assetUrls) {
    if (!assetUrl.endsWith(".css")) continue;
    const cssText = await readText(assetUrl);
    if (!cssText) continue;
    inlineStyles.push({ id: assetUrl, cssText });
  }

  const filteredStyles = assetUrls.filter((url) => !url.endsWith(".css"));

  return {
    moduleUrl,
    styles: filteredStyles,
    inlineStyles,
    cleanup,
  };
};
