import type { DappMetadata, DappMetadataInput } from "./types.js";
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

function normalizeUrl(value: string | undefined, base: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith("data:")) return value;
  try {
    return new URL(value, base ?? getLocationOrigin() ?? undefined).toString();
  } catch {
    return undefined;
  }
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

export function readDappMetadataFromDocument(): DappMetadataInput {
  const origin = getLocationOrigin();
  const url = getLocationHref();
  const base = origin ?? url;
  const favicon = getLinkHref('link[rel~="icon"]') ?? getLinkHref('link[rel="shortcut icon"]') ?? getLinkHref('link[rel="apple-touch-icon"]');
  const image = getMetaContent('meta[property="og:image"]') ?? getMetaContent('meta[name="twitter:image"]');
  const icon = normalizeUrl(favicon ?? image, base);
  const imageUrl = normalizeUrl(image, base);

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
    origin,
    icon,
    icons: uniq([icon, imageUrl]),
  };
}

export function resolveDappMetadata(input: DappMetadataInput = {}): DappMetadata {
  const detected = readDappMetadataFromDocument();
  const rawUrl = safeTrim(input.url) ?? safeTrim(detected.url);
  const baseOrigin = safeTrim(input.origin) ?? safeTrim(detected.origin) ?? originFromUrl(rawUrl) ?? DEFAULT_ORIGIN;
  const url = normalizeUrl(rawUrl, baseOrigin) ?? baseOrigin;
  const origin = safeTrim(input.origin) ?? originFromUrl(url) ?? safeTrim(detected.origin) ?? DEFAULT_ORIGIN;
  const icon = normalizeUrl(safeTrim(input.icon) ?? safeTrim(detected.icon), origin);
  const icons = uniq([
    icon,
    ...(input.icons ?? []).map((candidate) => normalizeUrl(candidate, origin)),
    ...(detected.icons ?? []).map((candidate) => normalizeUrl(candidate, origin)),
  ]);

  return {
    name: safeTrim(input.name) ?? safeTrim(detected.name) ?? DEFAULT_DAPP_NAME,
    description: safeTrim(input.description) ?? safeTrim(detected.description),
    url,
    origin,
    icon,
    icons,
  };
}

export function sameDappOrigin(left: DappMetadata, right: DappMetadata): boolean {
  return left.origin === right.origin;
}
