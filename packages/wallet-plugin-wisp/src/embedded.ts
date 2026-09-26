/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  createEvmFrameProvider,
  type EvmFrameProvider,
} from "@windstack/evm";
import {
  createVexaniumFrameProvider,
  type VexaniumFrameProvider,
} from "@windstack/vexanium";
import {
  createWispEip6963ProviderInfo,
  createWispVexaniumProviderInfo,
  type WispEip6963ProviderInfoOptions,
  type WispVexaniumProviderInfoOptions,
} from "./provider-info.js";
import { normalizeWispHttpsOrigin } from "./url.js";

export type WispEmbeddedProvidersOptions = {
  walletOrigin: string;
  referrer?: string;
  vexanium?: false | WispVexaniumProviderInfoOptions;
  evm?: false | WispEip6963ProviderInfoOptions;
  requestTimeoutMs?: number;
  window?: Window;
  parentWindow?: WindowProxy;
};

export type WispEmbeddedProviders = {
  parentOrigin: string;
  vexanium: VexaniumFrameProvider | null;
  evm: EvmFrameProvider | null;
  destroy(): void;
};

export function resolveWispEmbeddedParentOrigin(
  walletOrigin: string,
  referrer = typeof document === "undefined" ? "" : document.referrer,
): string {
  const expectedOrigin = normalizeWispHttpsOrigin(walletOrigin, "walletOrigin");
  const rawReferrer = String(referrer || "").trim();
  if (!rawReferrer) return expectedOrigin;

  let referrerOrigin: string;
  try {
    const parsed = new URL(rawReferrer);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("Referrer is not secure");
    }
    referrerOrigin = parsed.origin;
  } catch {
    throw new Error("Embedded DApp referrer must be a credential-free HTTPS URL");
  }

  if (referrerOrigin !== expectedOrigin) {
    throw new Error("Embedded DApp parent origin does not match the configured wallet origin");
  }
  return expectedOrigin;
}

export function installWispEmbeddedProviders(
  options: WispEmbeddedProvidersOptions,
): WispEmbeddedProviders {
  const parentOrigin = resolveWispEmbeddedParentOrigin(options.walletOrigin, options.referrer);
  const vexaniumOptions = options.vexanium === undefined ? {} : options.vexanium;
  const evmOptions = options.evm === undefined ? false : options.evm;

  if (vexaniumOptions === false && evmOptions === false) {
    throw new Error("At least one embedded provider must be enabled");
  }

  const vexanium =
    vexaniumOptions === false
      ? null
      : createVexaniumFrameProvider({
          parentOrigin,
          providerInfo: createWispVexaniumProviderInfo(vexaniumOptions),
          requestTimeoutMs: options.requestTimeoutMs,
          window: options.window,
          parentWindow: options.parentWindow,
        });
  const evm =
    evmOptions === false
      ? null
      : createEvmFrameProvider({
          parentOrigin,
          providerInfo: createWispEip6963ProviderInfo(evmOptions),
          requestTimeoutMs: options.requestTimeoutMs,
          window: options.window,
          parentWindow: options.parentWindow,
        });

  return {
    parentOrigin,
    vexanium,
    evm,
    destroy() {
      vexanium?.destroy();
      evm?.destroy();
    },
  };
}
