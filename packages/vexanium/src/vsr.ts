import { ABICache } from "@wharfkit/abicache";
import type { APIClient } from "@wharfkit/antelope";
import { SigningRequest } from "@wharfkit/signing-request";
import { VSR_SCHEME } from "./constants.js";
import type { VsrCreateInput, VsrCreateOptions, VsrUri } from "./types.js";

export function createAbiCache(client: APIClient): ABICache {
  return new ABICache(client);
}

export async function createVsr(args: VsrCreateInput, options: VsrCreateOptions = {}): Promise<string> {
  const request = await SigningRequest.create(args, options);
  return encodeVsr(request, options);
}

export function encodeVsr(request: SigningRequest, options: Pick<VsrCreateOptions, "compress" | "slashes"> = {}): string {
  return request.encode(options.compress ?? false, options.slashes ?? true, VSR_SCHEME);
}

export function normalizeVsrUri(uri: VsrUri): string {
  if (typeof uri !== "string" || uri.trim().length === 0) {
    throw new Error("Invalid VSR URI");
  }
  return uri.trim();
}

export function parseVsr(uri: VsrUri): SigningRequest {
  return SigningRequest.from(normalizeVsrUri(uri));
}

export async function createVsrFromAction(args: Omit<VsrCreateInput, "actions" | "transaction" | "identity">, options: VsrCreateOptions = {}): Promise<string> {
  return createVsr(args, options);
}
