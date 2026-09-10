/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AbiSerializer, hexToBytes } from "@windstack/abi";
import type { SigningRequest } from "./request.js";
import type { SigningRequestAbiProvider, SigningRequestAction } from "./types.js";

export type SigningRequestActionInspection = {
  index: number;
  contextFree: boolean;
  account: string;
  name: string;
  authorization: SigningRequestAction["authorization"];
  rawData: string;
  data: unknown;
};

export type SigningRequestActionSelectionOptions = {
  includeContextFree?: boolean;
};

function cloneAction(action: SigningRequestAction): SigningRequestAction {
  return {
    account: action.account,
    name: action.name,
    authorization: action.authorization.map((level) => ({ ...level })),
    data: action.data,
  };
}

/** Return every executable action from action, action-list, or transaction signing requests. */
export function getSigningRequestActions(
  request: SigningRequest,
  options: SigningRequestActionSelectionOptions = {},
): SigningRequestAction[] {
  const payload = request.getData().request;
  if (payload.type === "identity") return [];
  if (payload.type === "action") return [cloneAction(payload.value)];
  if (payload.type === "action[]") return payload.value.map(cloneAction);
  const actions = options.includeContextFree
    ? [...payload.value.context_free_actions, ...payload.value.actions]
    : payload.value.actions;
  return actions.map(cloneAction);
}

/**
 * Decode every signing-request action through its contract ABI.
 * ABI requests are deduplicated per account, including concurrent multi-action requests.
 */
export async function decodeSigningRequestActions(
  request: SigningRequest,
  abiProvider: SigningRequestAbiProvider,
  options: SigningRequestActionSelectionOptions & { signal?: AbortSignal } = {},
): Promise<SigningRequestActionInspection[]> {
  if (!abiProvider || typeof abiProvider.getAbi !== "function") {
    throw new TypeError("A signing-request ABI provider is required");
  }

  const payload = request.getData().request;
  if (payload.type === "identity") return [];

  const selected: Array<{ action: SigningRequestAction; contextFree: boolean }> =
    payload.type === "action"
      ? [{ action: payload.value, contextFree: false }]
      : payload.type === "action[]"
        ? payload.value.map((action) => ({ action, contextFree: false }))
        : [
            ...(options.includeContextFree
              ? payload.value.context_free_actions.map((action) => ({
                  action,
                  contextFree: true,
                }))
              : []),
            ...payload.value.actions.map((action) => ({ action, contextFree: false })),
          ];

  const pendingAbis = new Map<string, ReturnType<SigningRequestAbiProvider["getAbi"]>>();
  const loadAbi = (account: string) => {
    const pending = pendingAbis.get(account);
    if (pending) return pending;
    const requestAbi = abiProvider.getAbi(account, options.signal);
    pendingAbis.set(account, requestAbi);
    return requestAbi;
  };

  return Promise.all(
    selected.map(async ({ action, contextFree }, index) => {
      const abi = await loadAbi(action.account);
      const serializer = new AbiSerializer(abi);
      return {
        index,
        contextFree,
        account: action.account,
        name: action.name,
        authorization: action.authorization.map((level) => ({ ...level })),
        rawData: action.data,
        data: serializer.decodeAction(action.name, hexToBytes(action.data)),
      };
    }),
  );
}
