/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { normalizeVexaniumAccounts } from "./accounts.js";
import { VEXANIUM_PROVIDER_STANDARD, VEXANIUM_PROVIDER_VERSION } from "./constants.js";
import {
  assertVexaniumAccountsResponse,
  assertVexaniumCapabilitiesResponse,
  assertVexaniumChainChangedEvent,
  assertVexaniumConnectResponse,
  assertVexaniumDisconnectEvent,
  assertVexaniumProviderInfo,
} from "./standard.js";
import type {
  VexaniumAccount,
  VexaniumAccountsResponse,
  VexaniumCapabilitiesResponse,
  VexaniumCapability,
  VexaniumChainId,
  VexaniumAccountsChangedEvent,
  VexaniumChainChangedEvent,
  VexaniumConnectResponse,
  VexaniumDisconnectEvent,
  VexaniumFullChainId,
  VexaniumProviderInfo,
} from "./types.js";

export type CreateVexaniumProviderInfoInput = {
  uuid: string;
  name: string;
  rdns: string;
  icon?: string;
  version?: string;
  chains: readonly VexaniumChainId[];
  capabilities: readonly VexaniumCapability[];
};

export type CreateVexaniumCapabilitiesResponseInput = {
  version?: string;
  capabilities: readonly VexaniumCapability[];
  chains: readonly VexaniumChainId[];
  methods: readonly string[];
};

export type CreateVexaniumConnectResponseInput = {
  version?: string;
  sessionId: string;
  chainId: VexaniumFullChainId;
  accounts: readonly (VexaniumAccount | string)[];
  capabilities: readonly VexaniumCapability[];
};

export type CreateVexaniumAccountsResponseInput = {
  sessionId: string;
  chainId: VexaniumFullChainId;
  accounts: readonly (VexaniumAccount | string)[];
};

export type CreateVexaniumDisconnectEventInput = {
  code: number;
  message: string;
};

export function createVexaniumProviderInfo(
  input: CreateVexaniumProviderInfoInput,
): VexaniumProviderInfo {
  const value: VexaniumProviderInfo = {
    uuid: input.uuid,
    name: input.name,
    ...(input.icon ? { icon: input.icon } : {}),
    rdns: input.rdns,
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: input.version ?? VEXANIUM_PROVIDER_VERSION,
    chains: [...input.chains],
    capabilities: [...input.capabilities],
  };
  assertVexaniumProviderInfo(value);
  return Object.freeze({
    ...value,
    chains: Object.freeze([...value.chains]),
    capabilities: Object.freeze([...value.capabilities]),
  });
}

export function createVexaniumCapabilitiesResponse(
  input: CreateVexaniumCapabilitiesResponseInput,
): VexaniumCapabilitiesResponse {
  const value: VexaniumCapabilitiesResponse = {
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: input.version ?? VEXANIUM_PROVIDER_VERSION,
    capabilities: [...input.capabilities],
    chains: [...input.chains],
    methods: [...input.methods],
  };
  assertVexaniumCapabilitiesResponse(value);
  return value;
}

export function createVexaniumConnectResponse(
  input: CreateVexaniumConnectResponseInput,
): VexaniumConnectResponse {
  const value: VexaniumConnectResponse = {
    standard: VEXANIUM_PROVIDER_STANDARD,
    version: input.version ?? VEXANIUM_PROVIDER_VERSION,
    sessionId: input.sessionId,
    chainId: input.chainId,
    accounts: normalizeVexaniumAccounts(input.accounts, input.chainId),
    capabilities: [...input.capabilities],
  };
  assertVexaniumConnectResponse(value);
  return value;
}

export function createVexaniumAccountsResponse(
  input: CreateVexaniumAccountsResponseInput,
): VexaniumAccountsResponse {
  const value: VexaniumAccountsResponse = {
    sessionId: input.sessionId,
    chainId: input.chainId,
    accounts: normalizeVexaniumAccounts(input.accounts, input.chainId),
  };
  assertVexaniumAccountsResponse(value);
  return value;
}
export function createVexaniumAccountsChangedEvent(
  input: CreateVexaniumAccountsResponseInput,
): VexaniumAccountsChangedEvent {
  return createVexaniumAccountsResponse(input);
}

export function createVexaniumChainChangedEvent(
  chainId: VexaniumChainId,
): VexaniumChainChangedEvent {
  assertVexaniumChainChangedEvent(chainId);
  return chainId;
}

export function createVexaniumDisconnectEvent(
  input: CreateVexaniumDisconnectEventInput,
): VexaniumDisconnectEvent {
  const value: VexaniumDisconnectEvent = {
    code: input.code,
    message: input.message,
  };
  assertVexaniumDisconnectEvent(value);
  return Object.freeze({ ...value });
}
