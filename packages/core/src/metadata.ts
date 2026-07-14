import type { DappMetadata, DappMetadataInput, DappRequestContext } from "./types.js";
import { getRuntimeWindow } from "./window.js";

const DEFAULT_DAPP_NAME = "Wisp DApp";
const DEFAULT_ORIGIN = "unknown://local";

function safeTrim(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getMetaContent(selector: string): string | undefined {
  const runtimeWindow = getRuntimeWindow();
  const document = runtimeWindow?.document;
  if (!document?.querySelector) return undefined;
  return safeTrim(document.querySelector(selector)?.getAttribute("content"));
}

function getLinkHref(selector: string): string | undefined {
  const runtimeWindow = getRuntimeWindow();
  const document = runtimeWindow?.document;
  if (!document?.querySelector) return undefined;
  return safeTrim(document.querySelector(selector)?.getAttribute("href"));
}

function getDocumentTitle(): string | undefined {
  const runtimeWindow = getRuntimeWindow();
  return safeTrim(runtimeWindow?.document?.title);
}

function getLocationHref(): string | undefined {
  const runtimeWindow = getRuntimeWindow();
  return safeTrim(runtimeWindow?.location?.href);
}

function getLocationOrigin(): string | undefined {
  const runtimeWindow = getRuntimeWindow();
  return safeTrim(runtimeWindow?.location?.origin);
}

function normalizeUrl(
  value: string | undefined,
  base: string | undefined,
  allowedProtocols: readonly string[],
): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value, base ?? getLocationOrigin() ?? undefined);
    return allowedProtocols.includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizeImageUrl(value: string | undefined, base: string | undefined): string | undefined {
  if (typeof value === "string" && /^data:image\/(?:gif|jpeg|png|webp);base64,/i.test(value)) {
    return value;
  }
  return normalizeUrl(value, base, ["http:", "https:"]);
}

function originFromUrl(value: string | undefined): string | undefined {
  if (!value || value.startsWith("data:")) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function uniq(values: Array<string | undefined>): string[] | undefined {
  const result = [...new Set(values.filter((value): value is string => Boolean(value)))];
  return result.length > 0 ? result : undefined;
}

/** Read display metadata only. The runtime origin is intentionally not returned as metadata. */
export function readDappMetadataFromDocument(): DappMetadataInput {
  const origin = getLocationOrigin();
  const url = getLocationHref();
  const base = origin ?? url;
  const favicon = getLinkHref('link[rel~="icon"]') ?? getLinkHref('link[rel="shortcut icon"]') ?? getLinkHref('link[rel="apple-touch-icon"]');
  const image = getMetaContent('meta[property="og:image"]') ?? getMetaContent('meta[name="twitter:image"]');
  const icon = normalizeImageUrl(favicon ?? image, base);
  const imageUrl = normalizeImageUrl(image, base);

  return {
    name:
      getMetaContent('meta[property="og:site_name"]') ??
      getMetaContent('meta[name="application-name"]') ??
      getDocumentTitle(),
    description:
      getMetaContent('meta[name="description"]') ??
      getMetaContent('meta[property="og:description"]') ??
      getMetaContent('meta[name="twitter:description"]'),
    url,
    icon,
    icons: uniq([icon, imageUrl]),
  };
}

/**
 * Resolve human-readable dApp metadata.
 *
 * `input.origin` is deliberately ignored. A dApp-controlled field must never become the
 * authority used for wallet permissions. Wallet implementations must obtain the trusted
 * origin from their transport (for example `sender.origin` in a browser extension).
 */
export function resolveDappMetadata(input: DappMetadataInput = {}): DappMetadata {
  const detected = readDappMetadataFromDocument();
  const inputUrl = safeTrim(input.url);
  const detectedUrl = safeTrim(detected.url);
  const runtimeOrigin = getLocationOrigin();
  const baseOrigin = runtimeOrigin ?? originFromUrl(inputUrl) ?? originFromUrl(detectedUrl) ?? DEFAULT_ORIGIN;
  const url = normalizeUrl(inputUrl, baseOrigin, ["http:", "https:"])
    ?? normalizeUrl(detectedUrl, baseOrigin, ["http:", "https:"])
    ?? baseOrigin;
  const icon = normalizeImageUrl(safeTrim(input.icon) ?? safeTrim(detected.icon), baseOrigin);
  const icons = uniq([
    icon,
    ...(input.icons ?? []).map((candidate) => normalizeImageUrl(candidate, baseOrigin)),
    ...(detected.icons ?? []).map((candidate) => normalizeImageUrl(candidate, baseOrigin)),
  ]);

  return {
    name: safeTrim(input.name) ?? safeTrim(detected.name) ?? DEFAULT_DAPP_NAME,
    description: safeTrim(input.description) ?? safeTrim(detected.description),
    url,
    icon,
    icons,
  };
}

/**
 * Resolve the dApp-side runtime context used to bind the SDK's local session.
 * This is separate from display metadata. On the wallet side, the authoritative value
 * must come from the wallet's trusted transport rather than from request parameters.
 */
export function resolveDappRequestContext(): DappRequestContext {
  const runtimeOrigin = getLocationOrigin();
  if (runtimeOrigin) return { origin: runtimeOrigin, source: "runtime" };
  return { origin: DEFAULT_ORIGIN, source: "unknown" };
}

export function sameDappRequestOrigin(left: DappRequestContext, right: DappRequestContext): boolean {
  return left.origin === right.origin;
}
