/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  normalizeWispEpochMilliseconds,
  normalizeWispHttpsOrigin,
  normalizeWispHttpsUrl,
} from "./url.js";

export const WISP_LAUNCH_DEFAULT_URL = "https://link.windcrypto.com/dapp" as const;
export const WISP_LAUNCH_HOSTS = ["link.windcrypto.com", "windcrypto.com"] as const;
export const WISP_SIGNING_REQUEST_SCHEMES = ["vsr", "esr"] as const;

export type WispSigningRequestScheme = (typeof WISP_SIGNING_REQUEST_SCHEMES)[number];

export type WispLaunchMetadata = {
  requestId?: string;
  origin?: string;
  appName?: string;
  appIcon?: string;
  chainId?: string;
  expiresAt?: number;
};

export type WispWalletLaunchRequest =
  | ({
      kind: "browser";
      url: string;
    } & WispLaunchMetadata)
  | ({
      kind: "signing-request";
      payload: string;
      scheme: WispSigningRequestScheme;
    } & WispLaunchMetadata);

export type ParseWispWalletLaunchOptions = {
  linkHosts?: readonly string[];
  walletSchemes?: readonly string[];
};

export type BuildWispBrowserLaunchOptions = WispLaunchMetadata & {
  url: string;
  launchUrl?: string;
};

export type BuildWispSigningRequestLaunchOptions = WispLaunchMetadata & {
  payload: string;
  launchUrl?: string;
};

function signingRequestScheme(value: string): WispSigningRequestScheme | null {
  const match = /^([a-z][a-z0-9+.-]*):/iu.exec(value.trim());
  const scheme = match?.[1]?.toLowerCase();
  return WISP_SIGNING_REQUEST_SCHEMES.includes(scheme as WispSigningRequestScheme)
    ? (scheme as WispSigningRequestScheme)
    : null;
}

function firstParam(url: URL, keys: readonly string[]): string {
  for (const key of keys) {
    const value = url.searchParams.get(key);
    if (value?.trim()) return value.trim();
  }
  return "";
}

function launchMetadata(url: URL): WispLaunchMetadata | null {
  const requestId = firstParam(url, ["requestId", "id"]);
  const rawOrigin = firstParam(url, ["origin", "dappOrigin"]);
  const appName = firstParam(url, ["appName", "name"]);
  const rawIcon = firstParam(url, ["appIcon", "icon", "iconUrl"]);
  const chainId = firstParam(url, ["chainId"]);
  const expiresAt = normalizeWispEpochMilliseconds(
    firstParam(url, ["expiresAt", "exp", "expires"]),
  );

  let origin: string | undefined;
  let appIcon: string | undefined;
  try {
    if (rawOrigin) origin = normalizeWispHttpsOrigin(rawOrigin, "DApp origin");
    if (rawIcon) appIcon = normalizeWispHttpsUrl(rawIcon, "DApp icon");
  } catch {
    return null;
  }

  return {
    ...(requestId ? { requestId } : {}),
    ...(origin ? { origin } : {}),
    ...(appName ? { appName } : {}),
    ...(appIcon ? { appIcon } : {}),
    ...(chainId ? { chainId } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

function isAcceptedLaunchUrl(
  url: URL,
  linkHosts: readonly string[],
  walletSchemes: readonly string[],
): boolean {
  if (walletSchemes.includes(url.protocol.replace(/:$/u, "").toLowerCase())) return true;
  return (
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    linkHosts.includes(url.hostname.toLowerCase())
  );
}

function appendMetadata(url: URL, metadata: WispLaunchMetadata): void {
  if (metadata.requestId) url.searchParams.set("requestId", metadata.requestId);
  if (metadata.origin) url.searchParams.set("origin", metadata.origin);
  if (metadata.appName) url.searchParams.set("appName", metadata.appName);
  if (metadata.appIcon) url.searchParams.set("appIcon", normalizeWispHttpsUrl(metadata.appIcon));
  if (metadata.chainId) url.searchParams.set("chainId", metadata.chainId);
  const expiresAt = normalizeWispEpochMilliseconds(metadata.expiresAt);
  if (expiresAt) url.searchParams.set("expiresAt", String(expiresAt));
}

function createLaunchUrl(value: string = WISP_LAUNCH_DEFAULT_URL): URL {
  return new URL(normalizeWispHttpsUrl(value, "Wisp launch URL"));
}

export function buildWispBrowserLaunchUrl(options: BuildWispBrowserLaunchOptions): string {
  const target = new URL(normalizeWispHttpsUrl(options.url, "DApp URL"));
  const origin = options.origin
    ? normalizeWispHttpsOrigin(options.origin, "DApp origin")
    : target.origin;
  if (origin !== target.origin) {
    throw new Error("DApp origin must match the browser target origin");
  }

  const launch = createLaunchUrl(options.launchUrl);
  launch.searchParams.set("url", target.toString());
  appendMetadata(launch, { ...options, origin });
  return launch.toString();
}

export function buildWispSigningRequestLaunchUrl(
  options: BuildWispSigningRequestLaunchOptions,
): string {
  const payload = String(options.payload || "").trim();
  if (!signingRequestScheme(payload)) {
    throw new Error("Signing request payload must use the vsr: or esr: scheme");
  }
  const launch = createLaunchUrl(options.launchUrl);
  launch.searchParams.set("payload", payload);
  launch.searchParams.set("mode", "signing-request");
  appendMetadata(launch, options);
  return launch.toString();
}

export function parseWispWalletLaunchUrl(
  input: string,
  options: ParseWispWalletLaunchOptions = {},
): WispWalletLaunchRequest | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const directScheme = signingRequestScheme(raw);
  if (directScheme) {
    return { kind: "signing-request", payload: raw, scheme: directScheme };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const linkHosts = (options.linkHosts ?? WISP_LAUNCH_HOSTS).map((host) => host.toLowerCase());
  const walletSchemes = (options.walletSchemes ?? []).map((scheme) =>
    scheme.replace(/:$/u, "").toLowerCase(),
  );
  if (!isAcceptedLaunchUrl(url, linkHosts, walletSchemes)) return null;

  const metadata = launchMetadata(url);
  if (!metadata) return null;

  const payload = firstParam(url, ["payload", "vsr", "request", "uri"]);
  if (payload) {
    const scheme = signingRequestScheme(payload);
    if (!scheme) return null;
    return { kind: "signing-request", payload, scheme, ...metadata };
  }

  const target = firstParam(url, ["url", "dappUrl", "target", "href"]);
  if (!target) return null;
  try {
    const normalizedTarget = normalizeWispHttpsUrl(target, "DApp URL");
    if (metadata.origin && new URL(normalizedTarget).origin !== metadata.origin) return null;
    return { kind: "browser", url: normalizedTarget, ...metadata };
  } catch {
    return null;
  }
}

export function isWispLaunchRequestExpired(
  request: WispWalletLaunchRequest,
  now = Date.now(),
): boolean {
  return request.expiresAt !== undefined && request.expiresAt <= now;
}
