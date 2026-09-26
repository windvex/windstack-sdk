/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { isEIP6963ProviderInfo, type EIP6963ProviderInfo } from "@windstack/evm";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_PROVIDER_VERSION,
  createVexaniumProviderInfo,
  type VexaniumCapability,
  type VexaniumChainId,
  type VexaniumProviderInfo,
} from "@windstack/vexanium";
import { WISP_PROVIDER_NAME, WISP_PROVIDER_RDNS } from "./identity.js";

export type WispVexaniumProviderInfoOptions = {
  uuid: string;
  icon?: string;
  version?: string;
  chains?: readonly VexaniumChainId[];
  capabilities?: readonly VexaniumCapability[];
};

export type WispEip6963ProviderInfoOptions = {
  uuid: string;
  icon: string;
};

export function createWispVexaniumProviderInfo(
  options: WispVexaniumProviderInfoOptions,
): VexaniumProviderInfo {
  return createVexaniumProviderInfo({
    uuid: options.uuid,
    name: WISP_PROVIDER_NAME,
    rdns: WISP_PROVIDER_RDNS,
    ...(options.icon ? { icon: options.icon } : {}),
    version: options.version ?? VEXANIUM_PROVIDER_VERSION,
    chains: options.chains ?? [VEXANIUM_MAINNET_CHAIN_ID],
    capabilities:
      options.capabilities ??
      (Object.values(VEXANIUM_CAPABILITIES) as VexaniumCapability[]),
  });
}

export function createWispEip6963ProviderInfo(
  options: WispEip6963ProviderInfoOptions,
): EIP6963ProviderInfo {
  const info: EIP6963ProviderInfo = {
    uuid: options.uuid,
    name: WISP_PROVIDER_NAME,
    icon: options.icon,
    rdns: WISP_PROVIDER_RDNS,
  };
  if (!isEIP6963ProviderInfo(info)) {
    throw new TypeError("Invalid Wisp EIP-6963 provider metadata");
  }
  return Object.freeze({ ...info });
}
