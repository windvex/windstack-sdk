/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
export const WISP_PROVIDER_NAME = "Wisp" as const;
export const WISP_PROVIDER_RDNS = "com.wisp.wallet" as const;
export const WISP_PROVIDER_MARKER = "isWispWallet" as const;

export type WispProviderRdns = typeof WISP_PROVIDER_RDNS;

export function isWispProviderRdns(value: unknown): value is WispProviderRdns {
  return value === WISP_PROVIDER_RDNS;
}
