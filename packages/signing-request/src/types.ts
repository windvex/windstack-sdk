/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import type { Abi } from "@windstack/abi";
import type { Signature } from "@windstack/crypto";
import type { CompressionProvider } from "./compression.js";

export type SigningRequestScheme = "vsr" | "esr";
export type SigningRequestPermissionLevel = { actor: string; permission: string };

export type SigningRequestAction = {
  account: string;
  name: string;
  authorization: SigningRequestPermissionLevel[];
  /** ABI-packed action data, hexadecimal without a 0x prefix. */
  data: string;
};

export type SigningRequestActionInput = Omit<SigningRequestAction, "data"> & {
  /** ABI-packed hex/bytes or a structured value encoded through an AbiProvider. */
  data: string | Uint8Array | Record<string, unknown>;
};

export type SigningRequestExtension = { type: number; data: string };

export type SigningRequestTransaction = {
  expiration: string;
  ref_block_num: number;
  ref_block_prefix: number;
  max_net_usage_words: number;
  max_cpu_usage_ms: number;
  delay_sec: number;
  context_free_actions: SigningRequestAction[];
  actions: SigningRequestAction[];
  transaction_extensions: SigningRequestExtension[];
};

export type SigningRequestTransactionInput = Omit<
  SigningRequestTransaction,
  "context_free_actions" | "actions" | "transaction_extensions"
> & {
  context_free_actions?: SigningRequestActionInput[];
  actions: SigningRequestActionInput[];
  transaction_extensions?: Array<SigningRequestExtension | [number, string]>;
};

export type SigningRequestIdentity = {
  scope: string;
  permission?: SigningRequestPermissionLevel | null;
};

export type SigningRequestChain =
  | { type: "chain_alias"; value: number }
  | { type: "chain_id"; value: string };

export type SigningRequestPayload =
  | { type: "action"; value: SigningRequestAction }
  | { type: "action[]"; value: SigningRequestAction[] }
  | { type: "transaction"; value: SigningRequestTransaction }
  | { type: "identity"; value: SigningRequestIdentity };

export type SigningRequestInfoPair = { key: string; value: string };

export type SigningRequestData = {
  chainId: SigningRequestChain;
  request: SigningRequestPayload;
  flags: number;
  callback: string;
  info: SigningRequestInfoPair[];
};

export type SigningRequestSignature = {
  signer: string;
  signature: Signature;
};

export interface SigningRequestAbiProvider {
  getAbi(account: string, signal?: AbortSignal): Promise<Abi>;
}

export type SigningRequestInfoInput =
  | Record<string, string | Uint8Array>
  | SigningRequestInfoPair[];

export type SigningRequestCreateArguments = {
  chainId?: string;
  chainAlias?: number;
  /** Optional allowed-chain list encoded into the standard `chain_ids` info field. */
  allowedChains?: Array<string | number>;
  action?: SigningRequestActionInput;
  actions?: SigningRequestActionInput[];
  transaction?: SigningRequestTransactionInput;
  identity?: SigningRequestIdentity;
  broadcast?: boolean;
  background?: boolean;
  callback?: string;
  info?: SigningRequestInfoInput;
};

export type SigningRequestEncodingOptions = {
  abiProvider?: SigningRequestAbiProvider;
  compressionProvider?: CompressionProvider;
  compress?: boolean;
  slashes?: boolean;
  scheme?: SigningRequestScheme;
  maxDecodedBytes?: number;
  signal?: AbortSignal;
};

export type SigningRequestParseOptions = Pick<
  SigningRequestEncodingOptions,
  "maxDecodedBytes" | "compressionProvider"
>;

export type SigningRequestTapos = {
  expiration: string;
  refBlockNum: number;
  refBlockPrefix: number;
  refBlockId?: string;
};

export type SigningRequestResolveOptions = {
  actor: string;
  permission: string;
  abiProvider: SigningRequestAbiProvider;
  selectedChainId?: string;
  chainAliasResolver?: (alias: number) => string | undefined;
  tapos?: SigningRequestTapos;
  signal?: AbortSignal;
};

export type ResolvedSigningRequest = {
  chainId: string;
  signer: SigningRequestPermissionLevel;
  transaction: SigningRequestTransaction;
  serializedTransaction: Uint8Array;
  digest: Uint8Array;
  request: string;
  broadcast: boolean;
  background: boolean;
  callback: string;
  isIdentity: boolean;
  referenceBlockId?: string;
};

export type SigningRequestCallbackContext = {
  blockNum?: number;
  transactionId?: string;
  signatures: Array<string | Signature>;
};

export type SigningRequestCallback = {
  url: string;
  background: boolean;
  payload: Record<string, string>;
};
