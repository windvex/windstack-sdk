/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { RpcClient, type FetchLike } from "@windstack/rpc";
import {
  RpcSigningRequestAbiProvider,
  SigningRequest,
  pakoCompressionProvider,
  type CompressionProvider,
} from "@windstack/signing-request";
import { vexNative } from "./chains.js";
import { VSR_SCHEME } from "./constants.js";
import type {
  CanonicalSigningRequestUri,
  VexSigningRequestCreateInput,
  VexSigningRequestCreateOptions,
  VexSigningRequestParseOptions,
  VexSigningRequestUri,
  VexSigningRequestZlibProvider,
} from "./types.js";

const runtimeFetch: FetchLike = (input, init) => {
  const fetchImplementation = globalThis.fetch;
  if (typeof fetchImplementation !== "function") {
    throw new TypeError("A fetch implementation is required to resolve Vexanium contract ABIs");
  }
  return fetchImplementation(input, init);
};

const defaultAbiProvider = new RpcSigningRequestAbiProvider(
  new RpcClient({ endpoints: vexNative.rpcUrl, fetch: runtimeFetch }),
);

function compressionProvider(zlib?: VexSigningRequestZlibProvider): CompressionProvider {
  if (!zlib) return pakoCompressionProvider;
  return {
    deflate(data) {
      const output = zlib.deflateRaw(data);
      if (!(output instanceof Uint8Array)) {
        throw new TypeError("VSR compression provider returned invalid deflate output");
      }
      return output;
    },
    inflate(data, maxOutputBytes) {
      const output = zlib.inflateRaw(data);
      if (!(output instanceof Uint8Array)) {
        throw new TypeError("VSR compression provider returned invalid inflate output");
      }
      if (maxOutputBytes !== undefined && output.length > maxOutputBytes) {
        throw new RangeError("Inflated signing request exceeds the configured size limit");
      }
      return output;
    },
  };
}

function assertVexaniumSigningRequest(request: SigningRequest): SigningRequest {
  const selector = request.data.chainId;
  if (selector.type !== "chain_id" || selector.value.toLowerCase() !== vexNative.chainId) {
    throw new TypeError("VSR must target Vexanium Mainnet");
  }
  return request;
}

/** Create a canonical Vexanium Signing Request URI. */
export async function createSigningRequest(
  args: VexSigningRequestCreateInput,
  options: VexSigningRequestCreateOptions = {},
): Promise<CanonicalSigningRequestUri> {
  if (args.chainAlias !== undefined || args.allowedChains !== undefined) {
    throw new TypeError("VSR does not accept chain aliases or multi-chain selectors");
  }
  const chainId = args.chainId ?? vexNative.chainId;
  if (typeof chainId !== "string" || chainId.toLowerCase() !== vexNative.chainId) {
    throw new TypeError("VSR must target Vexanium Mainnet");
  }
  const request = await SigningRequest.create(
    { ...args, chainId: vexNative.chainId },
    {
      abiProvider: options.abiProvider ?? defaultAbiProvider,
      maxDecodedBytes: options.maxDecodedBytes,
      signal: options.signal,
    },
  );
  return encodeSigningRequest(request, options);
}

/** Encode a native WindStack SigningRequest using the canonical Vexanium `vsr:` scheme. */
export function encodeSigningRequest(
  request: SigningRequest,
  options: Pick<VexSigningRequestCreateOptions, "compress" | "slashes" | "zlib"> = {},
): CanonicalSigningRequestUri {
  assertVexaniumSigningRequest(request);
  return request.encode(
    options.compress ?? false,
    options.slashes ?? true,
    "vsr",
    compressionProvider(options.zlib),
  ) as CanonicalSigningRequestUri;
}

function assertSigningRequestUri(uri: VexSigningRequestUri): VexSigningRequestUri {
  if (typeof uri !== "string" || uri.length === 0 || uri !== uri.trim()) {
    throw new TypeError("Invalid Vexanium Signing Request URI");
  }
  const scheme = uri.slice(0, uri.indexOf(":") + 1).toLowerCase();
  if (scheme !== VSR_SCHEME) {
    throw new TypeError("Vexanium Signing Request URI must use the vsr: scheme");
  }
  return uri;
}

/** Parse a compressed or uncompressed Vexanium Signing Request. */
export function parseSigningRequest(
  uri: VexSigningRequestUri,
  options: VexSigningRequestParseOptions = {},
): SigningRequest {
  return assertVexaniumSigningRequest(
    SigningRequest.from(assertSigningRequestUri(uri), {
      maxDecodedBytes: options.maxDecodedBytes,
      compressionProvider: compressionProvider(options.zlib),
    }),
  );
}
