/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import type { DappMetadata } from "@windstack/core";
import {
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
} from "./constants.js";
import {
  VEXANIUM_ERROR_CODES,
  VexaniumProviderError,
  vexaniumInvalidParams,
  vexaniumUnsupportedChain,
} from "./errors.js";
import { assertVexaniumConnectResponse } from "./standard.js";
import type { VexaniumChainId, VexaniumClient, VexaniumConnectResponse } from "./types.js";
import { isVexaniumChainId, sameVexaniumChain } from "./validation.js";

export type VexaniumRestoreSessionParams = {
  /** Opaque wallet-issued session id returned by the original interactive connection. */
  sessionId: string;
  /** Defaults to Vexanium Mainnet. Restore can never switch chains. */
  chainId?: VexaniumChainId;
  /** Display metadata only. Wallet authorization must bind to trusted transport origin. */
  dapp?: DappMetadata;
};

export type VexaniumRestoreSessionRequest = {
  standard: typeof VEXANIUM_PROVIDER_STANDARD;
  version: string;
  sessionId: string;
  chainId: VexaniumChainId;
  dapp: DappMetadata;
};

function assertOpaqueSessionId(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 512 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw vexaniumInvalidParams("sessionId must be a non-empty opaque wallet session id");
  }
}

/**
 * Restores a wallet-authoritative Vexanium session without invoking interactive account approval.
 *
 * A provider must never create a new session from this request. Unknown, expired, or revoked
 * sessions must fail instead of falling back to `vex_requestAccounts`.
 */
export async function restoreVexaniumSession(
  client: VexaniumClient,
  params: VexaniumRestoreSessionParams,
): Promise<VexaniumConnectResponse> {
  assertOpaqueSessionId(params.sessionId);
  const chainId = params.chainId ?? VEXANIUM_MAINNET_CHAIN_ID;
  if (!isVexaniumChainId(chainId) || !sameVexaniumChain(chainId, VEXANIUM_MAINNET_CHAIN_ID)) {
    throw vexaniumUnsupportedChain(String(chainId));
  }

  const capabilities = await client.negotiate([
    VEXANIUM_CAPABILITIES.ACCOUNTS,
    VEXANIUM_CAPABILITIES.SESSIONS,
  ]);
  if (!capabilities.methods.includes(VEXANIUM_METHODS.RESTORE_SESSION)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.UNSUPPORTED_METHOD,
      `Provider does not support ${VEXANIUM_METHODS.RESTORE_SESSION}`,
      { method: VEXANIUM_METHODS.RESTORE_SESSION },
    );
  }

  const response = await client.request<VexaniumConnectResponse, VexaniumRestoreSessionRequest>({
    method: VEXANIUM_METHODS.RESTORE_SESSION,
    params: {
      standard: VEXANIUM_PROVIDER_STANDARD,
      version: VEXANIUM_PROVIDER_VERSION,
      sessionId: params.sessionId,
      chainId,
      dapp: params.dapp ?? client.getDappMetadata(),
    },
  });
  assertVexaniumConnectResponse(response);

  if (response.sessionId !== params.sessionId) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Wallet restored a different session id than requested",
      { requestedSessionId: params.sessionId, restoredSessionId: response.sessionId },
    );
  }
  if (!sameVexaniumChain(response.chainId, chainId)) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Wallet restored the session on a different Vexanium chain",
      { requestedChainId: chainId, restoredChainId: response.chainId },
    );
  }
  for (const capability of [VEXANIUM_CAPABILITIES.ACCOUNTS, VEXANIUM_CAPABILITIES.SESSIONS]) {
    if (!response.capabilities.includes(capability)) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        `Restored session is missing required capability ${capability}`,
        { capability },
      );
    }
  }

  // `vex_restoreSession` makes the requested wallet session current for this transport.
  // Synchronize through the normal account path so the VexaniumClient closure owns the
  // canonical session state used by signing, events, and disconnect after a cold start.
  const accounts = await client.syncAccounts();
  const activeSession = client.getSession();
  if (
    !activeSession ||
    activeSession.walletSessionId !== response.sessionId ||
    !sameVexaniumChain(activeSession.chainId, response.chainId)
  ) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Wallet restore did not activate the requested Vexanium session",
      { requestedSessionId: response.sessionId },
    );
  }
  if (!accounts[0]) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Wallet restored a Vexanium session without accounts",
    );
  }

  return { ...response, accounts };
}
