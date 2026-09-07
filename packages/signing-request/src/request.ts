/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AbiSerializer, bytesToHex, hexToBytes, nameToBigInt } from "@windstack/abi";
import {
  type PrivateKey,
  type PublicKey,
  Signature,
  concatBytes,
  sha256Digest,
} from "@windstack/crypto";
import { decodeBase64Url, encodeBase64Url } from "./base64url.js";
import { pakoCompressionProvider, type CompressionProvider } from "./compression.js";
import { SIGNING_REQUEST_ABI, SIGNING_REQUEST_ABI_V2 } from "./schema.js";
import type {
  SigningRequestAction,
  SigningRequestActionInput,
  SigningRequestChain,
  SigningRequestCreateArguments,
  SigningRequestData,
  SigningRequestEncodingOptions,
  SigningRequestIdentity,
  SigningRequestInfoInput,
  SigningRequestInfoPair,
  SigningRequestParseOptions,
  SigningRequestPayload,
  SigningRequestPermissionLevel,
  SigningRequestScheme,
  SigningRequestSignature,
  SigningRequestTransaction,
  SigningRequestTransactionInput,
} from "./types.js";

export const SIGNING_REQUEST_PROTOCOL_VERSION = 3;
export const SIGNING_REQUEST_MIN_SUPPORTED_VERSION = 2;
export const SIGNING_REQUEST_MAX_DECODED_BYTES = 1024 * 1024;
export const SIGNING_REQUEST_FLAG_BROADCAST = 1;
export const SIGNING_REQUEST_FLAG_BACKGROUND = 2;
export const SIGNING_REQUEST_PLACEHOLDER_ACTOR = "............1";
export const SIGNING_REQUEST_PLACEHOLDER_PERMISSION = "............2";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const serializer = new AbiSerializer(SIGNING_REQUEST_ABI);
const serializerV2 = new AbiSerializer(SIGNING_REQUEST_ABI_V2);
const REQUEST_SIGNATURE_WIRE_BYTES = 74;

function serializerForVersion(version: number): AbiSerializer {
  return version === 2 ? serializerV2 : serializer;
}
const CHAIN_IDS_INFO_KEY = "chain_ids";

function validateName(value: string, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} is required`);
  }
  nameToBigInt(value);
  return value;
}

function normalizeHex(value: string | Uint8Array, label: string): string {
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (typeof value !== "string") throw new TypeError(`${label} must be bytes or hexadecimal`);
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^(?:[0-9a-f]{2})*$/i.test(normalized)) {
    throw new TypeError(`${label} must be valid hexadecimal`);
  }
  return normalized.toLowerCase();
}

function normalizeChainValue(value: string | number, label: string): SigningRequestChain {
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new RangeError(`${label} alias must be an integer between 0 and 255`);
    }
    return { type: "chain_alias", value };
  }
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new TypeError(`${label} must be a 64-character chain id or a numeric alias`);
  }
  return { type: "chain_id", value: value.toLowerCase() };
}

function normalizeChain(args: SigningRequestCreateArguments): SigningRequestChain {
  if (args.chainId !== undefined && args.chainAlias !== undefined) {
    throw new TypeError("Specify either chainId or chainAlias, not both");
  }
  if (args.chainId !== undefined) return normalizeChainValue(args.chainId, "Signing-request chain");
  if (args.chainAlias !== undefined) {
    return normalizeChainValue(args.chainAlias, "Signing-request chain");
  }
  throw new TypeError("Signing request requires chainId or chainAlias");
}

function normalizePermissionLevel(
  value: SigningRequestPermissionLevel,
  label: string,
): SigningRequestPermissionLevel {
  if (!value || typeof value !== "object") throw new TypeError(`${label} is required`);
  return {
    actor: validateName(value.actor, `${label} actor`),
    permission: validateName(value.permission, `${label} permission`),
  };
}

async function normalizeAction(
  action: SigningRequestActionInput,
  abiProvider: SigningRequestEncodingOptions["abiProvider"],
  signal?: AbortSignal,
): Promise<SigningRequestAction> {
  if (!action || typeof action !== "object")
    throw new TypeError("Signing-request action is required");
  const account = validateName(action.account, "Action account");
  const name = validateName(action.name, "Action name");
  const authorization = (action.authorization ?? []).map((level, index) =>
    normalizePermissionLevel(level, `Authorization ${index}`),
  );

  let data: string;
  if (typeof action.data === "string" || action.data instanceof Uint8Array) {
    data = normalizeHex(action.data, "Action data");
  } else {
    if (!abiProvider) {
      throw new TypeError(
        `Structured action data for ${account}::${name} requires an ABI provider`,
      );
    }
    const abi = await abiProvider.getAbi(account, signal);
    data = bytesToHex(new AbiSerializer(abi).encodeAction(name, action.data));
  }

  return { account, name, authorization, data };
}

function assertTransactionNumbers(transaction: SigningRequestTransactionInput): void {
  const checks: Array<[number, number, string]> = [
    [transaction.ref_block_num, 0xffff, "ref_block_num"],
    [transaction.ref_block_prefix, 0xffffffff, "ref_block_prefix"],
    [transaction.max_net_usage_words, 0xffffffff, "max_net_usage_words"],
    [transaction.max_cpu_usage_ms, 0xff, "max_cpu_usage_ms"],
    [transaction.delay_sec, 0xffffffff, "delay_sec"],
  ];
  for (const [value, max, label] of checks) {
    if (!Number.isInteger(value) || value < 0 || value > max) {
      throw new RangeError(`${label} must be an integer between 0 and ${max}`);
    }
  }
}

async function normalizeTransaction(
  transaction: SigningRequestTransactionInput,
  abiProvider: SigningRequestEncodingOptions["abiProvider"],
  signal?: AbortSignal,
): Promise<SigningRequestTransaction> {
  if (!transaction || typeof transaction !== "object") {
    throw new TypeError("Signing-request transaction is required");
  }
  if (!Array.isArray(transaction.actions)) {
    throw new TypeError("Signing-request transaction actions must be an array");
  }
  assertTransactionNumbers(transaction);
  const contextFreeActions = await Promise.all(
    (transaction.context_free_actions ?? []).map((action) =>
      normalizeAction(action, abiProvider, signal),
    ),
  );
  const actions = await Promise.all(
    transaction.actions.map((action) => normalizeAction(action, abiProvider, signal)),
  );
  const transactionExtensions = (transaction.transaction_extensions ?? []).map((extension) => {
    const [type, data] = Array.isArray(extension) ? extension : [extension.type, extension.data];
    if (!Number.isInteger(type) || type < 0 || type > 0xffff) {
      throw new RangeError("Transaction extension type must be an integer between 0 and 65535");
    }
    return { type, data: normalizeHex(data, "Transaction extension data") };
  });

  return {
    expiration: String(transaction.expiration),
    ref_block_num: transaction.ref_block_num,
    ref_block_prefix: transaction.ref_block_prefix,
    max_net_usage_words: transaction.max_net_usage_words,
    max_cpu_usage_ms: transaction.max_cpu_usage_ms,
    delay_sec: transaction.delay_sec,
    context_free_actions: contextFreeActions,
    actions,
    transaction_extensions: transactionExtensions,
  };
}

function normalizeIdentity(identity: SigningRequestIdentity): SigningRequestIdentity {
  if (!identity || typeof identity !== "object")
    throw new TypeError("Identity request is required");
  return {
    scope: validateName(identity.scope ?? "", "Identity scope"),
    permission: identity.permission
      ? normalizePermissionLevel(identity.permission, "Identity permission")
      : null,
  };
}

function normalizeInfo(info: SigningRequestInfoInput | undefined): SigningRequestInfoPair[] {
  if (!info) return [];
  const entries = Array.isArray(info)
    ? info.map((pair) => [pair.key, pair.value] as const)
    : Object.entries(info);
  const seen = new Set<string>();
  return entries.map(([key, rawValue]) => {
    if (typeof key !== "string" || !key.length) {
      throw new TypeError("Signing-request info key cannot be empty");
    }
    if (seen.has(key)) throw new TypeError(`Duplicate signing-request info key: ${key}`);
    seen.add(key);
    const value =
      rawValue instanceof Uint8Array
        ? bytesToHex(rawValue)
        : Array.isArray(info)
          ? normalizeHex(String(rawValue), `Info value ${key}`)
          : bytesToHex(encoder.encode(String(rawValue)));
    return { key, value };
  });
}

function normalizeAllowedChains(
  allowedChains: Array<string | number> | undefined,
  primaryChain: SigningRequestChain,
  info: SigningRequestInfoPair[],
): SigningRequestInfoPair[] {
  if (allowedChains === undefined) return info;
  if (primaryChain.type !== "chain_alias" || primaryChain.value !== 0) {
    throw new TypeError("allowedChains is only valid for a multi-chain request using chainAlias 0");
  }
  if (!Array.isArray(allowedChains) || allowedChains.length === 0) {
    throw new TypeError("allowedChains must contain at least one chain");
  }
  if (info.some((pair) => pair.key === CHAIN_IDS_INFO_KEY)) {
    throw new TypeError("chain_ids info is managed by allowedChains and cannot be supplied twice");
  }
  const chains = allowedChains.map((chain, index) =>
    normalizeChainValue(chain, `Allowed chain ${index}`),
  );
  const identities = chains.map((chain) => `${chain.type}:${chain.value}`);
  if (new Set(identities).size !== identities.length) {
    throw new TypeError("allowedChains cannot contain duplicate chains");
  }
  const encoded = serializer.encode(
    "variant_id[]",
    chains.map((chain) => ({ type: chain.type, value: chain.value })),
  );
  return [...info, { key: CHAIN_IDS_INFO_KEY, value: bytesToHex(encoded) }];
}

async function createPayload(
  args: SigningRequestCreateArguments,
  options: SigningRequestEncodingOptions,
): Promise<SigningRequestPayload> {
  const supplied = [args.action, args.actions, args.transaction, args.identity].filter(
    (value) => value !== undefined,
  );
  if (supplied.length !== 1) {
    throw new TypeError(
      "Signing request must contain exactly one action, actions, transaction, or identity request",
    );
  }
  if (args.action) {
    return {
      type: "action",
      value: await normalizeAction(args.action, options.abiProvider, options.signal),
    };
  }
  if (args.actions) {
    if (!args.actions.length) throw new TypeError("Signing-request action list cannot be empty");
    return {
      type: "action[]",
      value: await Promise.all(
        args.actions.map((action) => normalizeAction(action, options.abiProvider, options.signal)),
      ),
    };
  }
  if (args.transaction) {
    return {
      type: "transaction",
      value: await normalizeTransaction(args.transaction, options.abiProvider, options.signal),
    };
  }
  return { type: "identity", value: normalizeIdentity(args.identity!) };
}

function clonePermissionLevel(value: SigningRequestPermissionLevel): SigningRequestPermissionLevel {
  return { actor: value.actor, permission: value.permission };
}

function cloneAction(value: SigningRequestAction): SigningRequestAction {
  return {
    account: value.account,
    name: value.name,
    authorization: value.authorization.map(clonePermissionLevel),
    data: value.data,
  };
}

function cloneTransaction(value: SigningRequestTransaction): SigningRequestTransaction {
  return {
    expiration: value.expiration,
    ref_block_num: value.ref_block_num,
    ref_block_prefix: value.ref_block_prefix,
    max_net_usage_words: value.max_net_usage_words,
    max_cpu_usage_ms: value.max_cpu_usage_ms,
    delay_sec: value.delay_sec,
    context_free_actions: value.context_free_actions.map(cloneAction),
    actions: value.actions.map(cloneAction),
    transaction_extensions: value.transaction_extensions.map((extension) => ({ ...extension })),
  };
}

function clonePayload(value: SigningRequestPayload): SigningRequestPayload {
  switch (value.type) {
    case "action":
      return { type: value.type, value: cloneAction(value.value) };
    case "action[]":
      return { type: value.type, value: value.value.map(cloneAction) };
    case "transaction":
      return { type: value.type, value: cloneTransaction(value.value) };
    case "identity":
      return {
        type: value.type,
        value: {
          ...(value.value.scope !== undefined ? { scope: value.value.scope } : {}),
          permission: value.value.permission
            ? clonePermissionLevel(value.value.permission)
            : (value.value.permission ?? null),
        },
      };
  }
}

function cloneData(data: SigningRequestData): SigningRequestData {
  return {
    chainId: { ...data.chainId },
    request: clonePayload(data.request),
    flags: data.flags,
    callback: data.callback,
    info: data.info.map((pair) => ({ ...pair })),
  };
}

function toAbiData(data: SigningRequestData, version: number): Record<string, unknown> {
  const requestValue =
    version === 2 && data.request.type === "identity"
      ? { permission: data.request.value.permission ?? null }
      : data.request.value;
  return {
    chain_id: { type: data.chainId.type, value: data.chainId.value },
    req: { type: data.request.type, value: requestValue },
    flags: data.flags,
    callback: data.callback,
    info: data.info,
  };
}

function fromAbiData(value: unknown, version: number): SigningRequestData {
  if (!value || typeof value !== "object") throw new TypeError("Invalid signing-request payload");
  const record = value as Record<string, unknown>;
  const chain = record.chain_id as { type?: unknown; value?: unknown };
  const request = record.req as { type?: unknown; value?: unknown };
  if (!chain || (chain.type !== "chain_alias" && chain.type !== "chain_id")) {
    throw new TypeError("Invalid signing-request chain selector");
  }
  if (
    !request ||
    !["action", "action[]", "transaction", "identity"].includes(String(request.type))
  ) {
    throw new TypeError("Invalid signing-request request type");
  }
  const chainId: SigningRequestChain =
    chain.type === "chain_alias"
      ? { type: "chain_alias", value: Number(chain.value) }
      : { type: "chain_id", value: String(chain.value).toLowerCase() };
  const requestType = String(request.type) as SigningRequestPayload["type"];
  const requestValue =
    version === 2 && requestType === "identity"
      ? {
          permission:
            request.value && typeof request.value === "object"
              ? ((request.value as { permission?: SigningRequestPermissionLevel | null })
                  .permission ?? null)
              : null,
        }
      : request.value;
  return {
    chainId,
    request: {
      type: requestType,
      value: requestValue,
    } as SigningRequestPayload,
    flags: Number(record.flags),
    callback: String(record.callback ?? ""),
    info: Array.isArray(record.info)
      ? (record.info as Array<{ key: string; value: string }>).map((pair) => ({
          key: String(pair.key),
          value: String(pair.value).toLowerCase(),
        }))
      : [],
  };
}

function validateFlags(data: SigningRequestData): void {
  if (!Number.isInteger(data.flags) || data.flags < 0 || data.flags > 0xff) {
    throw new RangeError("Signing-request flags must fit in one byte");
  }
  if ((data.flags & ~(SIGNING_REQUEST_FLAG_BROADCAST | SIGNING_REQUEST_FLAG_BACKGROUND)) !== 0) {
    throw new TypeError("Signing request contains unsupported flags");
  }
  if (data.request.type === "identity") {
    if (!data.callback) throw new TypeError("Identity signing requests require a callback");
    if ((data.flags & SIGNING_REQUEST_FLAG_BROADCAST) !== 0) {
      throw new TypeError("Identity signing requests cannot request broadcast");
    }
  }
  if ((data.flags & SIGNING_REQUEST_FLAG_BACKGROUND) !== 0 && !data.callback) {
    throw new TypeError("Background callback flag requires a callback URL");
  }
}

function parseUri(uri: string): {
  scheme: SigningRequestScheme;
  payload: string;
  slashes: boolean;
} {
  if (typeof uri !== "string" || !uri.length || uri !== uri.trim()) {
    throw new TypeError("Invalid signing-request URI");
  }
  const match = /^(vsr|esr):(\/\/)?([A-Za-z0-9_-]+)$/i.exec(uri);
  if (!match) throw new TypeError("Signing-request URI must use a valid vsr: or esr: payload");
  return {
    scheme: match[1]!.toLowerCase() as SigningRequestScheme,
    slashes: Boolean(match[2]),
    payload: match[3]!,
  };
}

export class SigningRequest {
  readonly version: number;
  readonly sourceUri: string | null;
  readonly sourceScheme: SigningRequestScheme | null;
  readonly sourceSlashes: boolean;
  readonly #data: SigningRequestData;
  readonly #requestSignature: SigningRequestSignature | null;

  private constructor(args: {
    version: number;
    data: SigningRequestData;
    requestSignature?: SigningRequestSignature | null;
    sourceUri?: string | null;
    sourceScheme?: SigningRequestScheme | null;
    sourceSlashes?: boolean;
  }) {
    if (
      !Number.isInteger(args.version) ||
      args.version < SIGNING_REQUEST_MIN_SUPPORTED_VERSION ||
      args.version > SIGNING_REQUEST_PROTOCOL_VERSION
    ) {
      throw new TypeError(`Unsupported signing-request protocol version: ${args.version}`);
    }
    validateFlags(args.data);
    this.version = args.version;
    this.#data = cloneData(args.data);
    this.#requestSignature = args.requestSignature
      ? Object.freeze({ ...args.requestSignature })
      : null;
    this.sourceUri = args.sourceUri ?? null;
    this.sourceScheme = args.sourceScheme ?? null;
    this.sourceSlashes = args.sourceSlashes ?? false;
  }

  static async create(
    args: SigningRequestCreateArguments,
    options: SigningRequestEncodingOptions = {},
  ): Promise<SigningRequest> {
    const request = await createPayload(args, options);
    const callback = args.callback ?? "";
    const flags =
      (args.broadcast ? SIGNING_REQUEST_FLAG_BROADCAST : 0) |
      (args.background ? SIGNING_REQUEST_FLAG_BACKGROUND : 0);
    const chainId = normalizeChain(args);
    const info = normalizeAllowedChains(args.allowedChains, chainId, normalizeInfo(args.info));
    return new SigningRequest({
      version: SIGNING_REQUEST_PROTOCOL_VERSION,
      data: { chainId, request, flags, callback, info },
    });
  }

  static from(uri: string, options: SigningRequestParseOptions = {}): SigningRequest {
    const parsed = parseUri(uri);
    const maxDecodedBytes = options.maxDecodedBytes ?? SIGNING_REQUEST_MAX_DECODED_BYTES;
    if (!Number.isSafeInteger(maxDecodedBytes) || maxDecodedBytes <= 0) {
      throw new RangeError("maxDecodedBytes must be a positive safe integer");
    }
    const encoded = decodeBase64Url(parsed.payload, Math.max(maxDecodedBytes * 2, 1024));
    if (!encoded.length) throw new TypeError("Signing-request payload is empty");
    const header = encoded[0]!;
    const version = header & 0x7f;
    if (
      version < SIGNING_REQUEST_MIN_SUPPORTED_VERSION ||
      version > SIGNING_REQUEST_PROTOCOL_VERSION
    ) {
      throw new TypeError(`Unsupported signing-request protocol version: ${version}`);
    }
    const compressed = (header & 0x80) !== 0;
    const compression = options.compressionProvider ?? pakoCompressionProvider;
    const payload = compressed
      ? compression.inflate(encoded.slice(1), maxDecodedBytes)
      : encoded.slice(1);
    if (payload.length > maxDecodedBytes) {
      throw new RangeError("Signing-request payload is too large");
    }

    const bodySerializer = serializerForVersion(version);
    let data: SigningRequestData;
    let requestSignature: SigningRequestSignature | null = null;
    try {
      data = fromAbiData(bodySerializer.decode("signing_request", payload), version);
    } catch (unsignedError) {
      if (payload.length <= REQUEST_SIGNATURE_WIRE_BYTES) throw unsignedError;
      const body = payload.slice(0, -REQUEST_SIGNATURE_WIRE_BYTES);
      const signatureBytes = payload.slice(-REQUEST_SIGNATURE_WIRE_BYTES);
      data = fromAbiData(bodySerializer.decode("signing_request", body), version);
      const decodedSignature = bodySerializer.decode("request_signature", signatureBytes) as {
        signer: string;
        signature: string;
      };
      requestSignature = {
        signer: validateName(decodedSignature.signer, "Request signer"),
        signature: Signature.fromString(decodedSignature.signature),
      };
    }
    validateFlags(data);
    return new SigningRequest({
      version,
      data,
      requestSignature,
      sourceUri: uri,
      sourceScheme: parsed.scheme,
      sourceSlashes: parsed.slashes,
    });
  }

  get data(): SigningRequestData {
    return cloneData(this.#data);
  }

  get requestSignature(): SigningRequestSignature | null {
    return this.#requestSignature ? { ...this.#requestSignature } : null;
  }

  get isBroadcast(): boolean {
    return (this.#data.flags & SIGNING_REQUEST_FLAG_BROADCAST) !== 0;
  }

  get isBackground(): boolean {
    return (this.#data.flags & SIGNING_REQUEST_FLAG_BACKGROUND) !== 0;
  }

  get isIdentity(): boolean {
    return this.#data.request.type === "identity";
  }

  getData(): SigningRequestData {
    return cloneData(this.#data);
  }

  getInfo(key: string): Uint8Array | null {
    const pair = this.#data.info.find((item) => item.key === key);
    return pair ? hexToBytes(pair.value) : null;
  }

  getInfoText(key: string): string | null {
    const value = this.getInfo(key);
    return value ? decoder.decode(value) : null;
  }

  getAllowedChains(): SigningRequestChain[] {
    const value = this.getInfo(CHAIN_IDS_INFO_KEY);
    if (!value) return [];
    const decoded = serializer.decode("variant_id[]", value);
    if (!Array.isArray(decoded)) throw new TypeError("Invalid chain_ids signing-request info");
    return decoded.map((item) => {
      if (!item || typeof item !== "object") {
        throw new TypeError("Invalid chain_ids signing-request entry");
      }
      const record = item as { type?: unknown; value?: unknown };
      if (record.type === "chain_alias") {
        return normalizeChainValue(Number(record.value), "Allowed chain");
      }
      if (record.type === "chain_id") {
        return normalizeChainValue(String(record.value), "Allowed chain");
      }
      throw new TypeError("Invalid chain_ids signing-request selector");
    });
  }

  getRequestDigest(): Uint8Array {
    return sha256Digest(
      concatBytes(Uint8Array.of(this.version), encoder.encode("request"), this.serializeBody()),
    );
  }

  sign(signer: string, privateKey: PrivateKey): SigningRequest {
    validateName(signer, "Request signer");
    const signature = privateKey.signDigest(this.getRequestDigest());
    return new SigningRequest({
      version: this.version,
      data: this.#data,
      requestSignature: { signer, signature },
      sourceScheme: this.sourceScheme,
      sourceSlashes: this.sourceSlashes,
    });
  }

  verifyRequestSignature(publicKey: PublicKey): boolean {
    return (
      this.#requestSignature?.signature.verifyDigest(this.getRequestDigest(), publicKey) ?? false
    );
  }

  serializeBody(): Uint8Array {
    return serializerForVersion(this.version).encode(
      "signing_request",
      toAbiData(this.#data, this.version),
    );
  }

  serializePayload(): Uint8Array {
    const body = this.serializeBody();
    if (!this.#requestSignature) return body;
    const signature = serializer.encode("request_signature", {
      signer: this.#requestSignature.signer,
      signature: this.#requestSignature.signature.toString(),
    });
    return concatBytes(body, signature);
  }

  encode(
    compress = false,
    slashes = false,
    scheme: SigningRequestScheme = "esr",
    compressionProvider: CompressionProvider = pakoCompressionProvider,
  ): string {
    const raw = this.serializePayload();
    const payload = compress ? compressionProvider.deflate(raw) : raw;
    const header = this.version | (compress ? 0x80 : 0);
    return `${scheme}:${slashes ? "//" : ""}${encodeBase64Url(
      concatBytes(Uint8Array.of(header), payload),
    )}`;
  }
}

export async function createSigningRequest(
  args: SigningRequestCreateArguments,
  options: SigningRequestEncodingOptions = {},
): Promise<SigningRequest> {
  return SigningRequest.create(args, options);
}

export function parseSigningRequest(
  uri: string,
  options: SigningRequestParseOptions = {},
): SigningRequest {
  return SigningRequest.from(uri, options);
}
