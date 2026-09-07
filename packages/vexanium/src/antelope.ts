/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import {
  AntelopeClient,
  type AntelopeClientOptions,
  type PrivateKey,
  PrivateKeySigner,
} from "@windstack/antelope";
import { vexNative } from "./chains.js";

export const VEXANIUM_LEGACY_PUBLIC_KEY_PREFIX = "VEX" as const;

export const VEXANIUM_ANTELOPE_MAINNET = Object.freeze({
  name: vexNative.displayName,
  chainId: vexNative.chainId,
  endpoints: [vexNative.rpcUrl] as const,
  contracts: Object.freeze({
    system: vexNative.contracts.system,
    token: vexNative.contracts.token,
  }),
  nativeToken: Object.freeze(vexNative.token),
});

export type VexaniumAntelopeClientOptions = Omit<
  AntelopeClientOptions,
  "endpoints" | "chainId" | "contracts"
> & {
  endpoints?: AntelopeClientOptions["endpoints"];
};

export function createVexaniumAntelopeClient(
  options: VexaniumAntelopeClientOptions = {},
): AntelopeClient {
  const { endpoints = vexNative.rpcUrl, ...clientOptions } = options;
  return new AntelopeClient({
    ...clientOptions,
    endpoints,
    chainId: vexNative.chainId,
    contracts: VEXANIUM_ANTELOPE_MAINNET.contracts,
  });
}

/** Create a local signer whose available K1 keys use Vexanium's native `VEX` prefix. */
export function createVexaniumPrivateKeySigner(keys: PrivateKey[]): PrivateKeySigner {
  return new PrivateKeySigner(keys, {
    k1PublicKeyFormat: "legacy",
    legacyPublicKeyPrefix: VEXANIUM_LEGACY_PUBLIC_KEY_PREFIX,
  });
}
