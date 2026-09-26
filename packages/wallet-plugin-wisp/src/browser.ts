/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { normalizeWispHttpsOrigin, normalizeWispHttpsUrl } from "./url.js";

export const WISP_BROWSER_NAVIGATION_MESSAGE = "wisp:browser:navigate" as const;
export const WISP_BROWSER_NAVIGATION_VERSION = 1 as const;

export type WispBrowserNavigationDisposition = "browser" | "external";

export type WispBrowserNavigationMessage = Readonly<{
  type: typeof WISP_BROWSER_NAVIGATION_MESSAGE;
  version: typeof WISP_BROWSER_NAVIGATION_VERSION;
  url: string;
  disposition?: WispBrowserNavigationDisposition;
}>;

export type PostWispBrowserNavigationOptions = {
  url: string;
  disposition?: WispBrowserNavigationDisposition;
  parentOrigin: string;
  window?: Window;
  parentWindow?: WindowProxy;
};

export function createWispBrowserNavigationMessage(
  url: string,
  disposition: WispBrowserNavigationDisposition = "browser",
): WispBrowserNavigationMessage {
  return Object.freeze({
    type: WISP_BROWSER_NAVIGATION_MESSAGE,
    version: WISP_BROWSER_NAVIGATION_VERSION,
    url: normalizeWispHttpsUrl(url, "navigation URL"),
    disposition,
  });
}

export function parseWispBrowserNavigationMessage(
  value: unknown,
): WispBrowserNavigationMessage | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<WispBrowserNavigationMessage>;
  if (
    candidate.type !== WISP_BROWSER_NAVIGATION_MESSAGE ||
    candidate.version !== WISP_BROWSER_NAVIGATION_VERSION ||
    typeof candidate.url !== "string" ||
    (candidate.disposition !== undefined &&
      candidate.disposition !== "browser" &&
      candidate.disposition !== "external")
  ) {
    return null;
  }
  try {
    return createWispBrowserNavigationMessage(candidate.url, candidate.disposition ?? "browser");
  } catch {
    return null;
  }
}

export function postWispBrowserNavigation(options: PostWispBrowserNavigationOptions): void {
  const runtimeWindow = options.window ?? globalThis.window;
  if (!runtimeWindow) throw new Error("Browser navigation requires a browser window");
  const targetWindow = options.parentWindow ?? runtimeWindow.parent;
  if (!targetWindow || targetWindow === runtimeWindow) {
    throw new Error("Browser navigation requires an embedded DApp frame");
  }
  const parentOrigin = normalizeWispHttpsOrigin(options.parentOrigin, "parentOrigin");
  targetWindow.postMessage(
    createWispBrowserNavigationMessage(options.url, options.disposition),
    parentOrigin,
  );
}
