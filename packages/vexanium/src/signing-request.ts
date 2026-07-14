import {
  SigningRequest,
  type ZlibProvider,
} from "@wharfkit/signing-request";
import { deflateRaw, inflateRaw } from "pako";
import { ESR_SCHEME, VSR_SCHEME } from "./constants.js";
import type {
  CanonicalSigningRequestUri,
  VexSigningRequestCreateInput,
  VexSigningRequestCreateOptions,
  VexSigningRequestParseOptions,
  VexSigningRequestUri,
} from "./types.js";

const defaultZlib: ZlibProvider = { deflateRaw, inflateRaw };

/**
 * Create the canonical Vexanium Signing Request URI.
 *
 * VSR v1 uses the ESR Revision 3 compatible payload implemented by WharfKit,
 * with the Vexanium-owned `vsr:` URI scheme. Existing `esr:` URIs remain accepted
 * as interoperability input.
 */
export async function createSigningRequest(
  args: VexSigningRequestCreateInput,
  options: VexSigningRequestCreateOptions = {},
): Promise<CanonicalSigningRequestUri> {
  const { compress, slashes, ...createOptions } = options;
  const zlib = createOptions.zlib ?? (compress === true ? defaultZlib : undefined);
  const request = await SigningRequest.create(args, { ...createOptions, zlib });
  return encodeSigningRequest(request, { compress, slashes, zlib });
}

/** Encode a WharfKit SigningRequest using the canonical Vexanium `vsr:` scheme. */
export function encodeSigningRequest(
  request: SigningRequest,
  options: Pick<VexSigningRequestCreateOptions, "compress" | "slashes" | "zlib"> = {},
): CanonicalSigningRequestUri {
  const zlib = options.zlib ?? defaultZlib;
  const encodableRequest = options.compress === true
    ? SigningRequest.from(request.encode(false), { zlib })
    : request;

  return encodableRequest.encode(
    options.compress,
    options.slashes ?? true,
    VSR_SCHEME,
  ) as CanonicalSigningRequestUri;
}

function assertSigningRequestUri(uri: VexSigningRequestUri): VexSigningRequestUri {
  if (typeof uri !== "string" || uri.length === 0 || uri !== uri.trim()) {
    throw new Error("Invalid signing-request URI");
  }

  const separatorIndex = uri.indexOf(":");
  if (separatorIndex <= 0) {
    throw new Error("Signing-request URI must use the vsr: or esr: scheme");
  }

  const scheme = uri.slice(0, separatorIndex + 1);
  const payload = uri.slice(separatorIndex + 1);

  if (scheme !== VSR_SCHEME && scheme !== ESR_SCHEME) {
    throw new Error(`Unsupported signing-request scheme: ${scheme}`);
  }
  if (payload.replace(/^\/\//, "").length === 0) {
    throw new Error("Signing-request URI payload is empty");
  }

  return uri;
}

/** Parse compressed or uncompressed VSR/ESR without rewriting its URI or payload. */
export function parseSigningRequest(
  uri: VexSigningRequestUri,
  options: VexSigningRequestParseOptions = {},
): SigningRequest {
  return SigningRequest.from(assertSigningRequestUri(uri), {
    ...options,
    zlib: options.zlib ?? defaultZlib,
  });
}
