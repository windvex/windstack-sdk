/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AntelopeClient, type AntelopeClientOptions } from "./index.js";

export const VEXANIUM_MAINNET_CHAIN_ID =
  "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f" as const;
export const VEXANIUM_MAINNET_RPC = "https://api.windcrypto.com" as const;
export const VEXANIUM_SYSTEM_CONTRACT = "vexcore" as const;
export const VEXANIUM_TOKEN_CONTRACT = "vex.token" as const;
export const VEXANIUM_NATIVE_SYMBOL = "VEX" as const;
export const VEXANIUM_NATIVE_PRECISION = 4 as const;

export const VEXANIUM_MAINNET = Object.freeze({
  name: "Vexanium Mainnet",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  endpoints: [VEXANIUM_MAINNET_RPC] as const,
  contracts: Object.freeze({
    system: VEXANIUM_SYSTEM_CONTRACT,
    token: VEXANIUM_TOKEN_CONTRACT,
  }),
  nativeToken: Object.freeze({
    contract: VEXANIUM_TOKEN_CONTRACT,
    symbol: VEXANIUM_NATIVE_SYMBOL,
    precision: VEXANIUM_NATIVE_PRECISION,
  }),
});

export type VexaniumClientOptions = Omit<
  AntelopeClientOptions,
  "endpoints" | "chainId" | "contracts"
> & {
  endpoints?: AntelopeClientOptions["endpoints"];
};

export function createVexaniumClient(options: VexaniumClientOptions = {}): AntelopeClient {
  const { endpoints = VEXANIUM_MAINNET_RPC, ...clientOptions } = options;
  return new AntelopeClient({
    ...clientOptions,
    endpoints,
    chainId: VEXANIUM_MAINNET_CHAIN_ID,
    contracts: VEXANIUM_MAINNET.contracts,
  });
}
