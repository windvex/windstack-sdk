import { SigningRequest } from "@wharfkit/signing-request";
import { ESR_SCHEME, VSR_SCHEME } from "./constants.js";
import type {
  CanonicalSigningRequestUri,
  VexSigningRequestCreateInput,
  VexSigningRequestCreateOptions,
  VexSigningRequestUri,
} from "./types.js";

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
  const request = await SigningRequest.create(args, options);
  return encodeSigningRequest(request, options);
}

/** Encode a WharfKit SigningRequest using the canonical Vexanium `vsr:` scheme. */
export function encodeSigningRequest(
  request: SigningRequest,
  options: Pick<VexSigningRequestCreateOptions, "compress" | "slashes"> = {},
): CanonicalSigningRequestUri {
  return request.encode(options.compress, options.slashes ?? true, VSR_SCHEME) as CanonicalSigningRequestUri;
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

/** Parse VSR or ESR directly with WharfKit without rewriting the URI or payload. */
export function parseSigningRequest(uri: VexSigningRequestUri): SigningRequest {
  return SigningRequest.from(assertSigningRequestUri(uri));
}
