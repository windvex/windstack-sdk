/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
export function normalizeWispHttpsOrigin(value: string, label = "origin"): string {
  const raw = String(value || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TypeError(`${label} must be an HTTPS origin`);
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.origin !== raw.replace(/\/$/u, "")
  ) {
    throw new TypeError(`${label} must be an exact credential-free HTTPS origin`);
  }
  return parsed.origin;
}

export function normalizeWispHttpsUrl(value: string, label = "URL"): string {
  const raw = String(value || "").trim();
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new TypeError(`${label} must be a valid HTTPS URL`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new TypeError(`${label} must be a credential-free HTTPS URL`);
  }
  return parsed.toString();
}

export function normalizeWispEpochMilliseconds(value: unknown): number | undefined {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
}
