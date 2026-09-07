/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { PublicKey, Signature } from "@windstack/crypto";
import type {
  ResolvedSigningRequest,
  SigningRequestCallback,
  SigningRequestCallbackContext,
} from "./types.js";

function signatureString(value: string | Signature): string {
  return typeof value === "string" ? Signature.fromString(value).toString() : value.toString();
}

export function verifyResolvedSigningRequestSignature(
  resolved: ResolvedSigningRequest,
  signature: string | Signature,
  publicKey: string | PublicKey,
): boolean {
  const parsedSignature =
    typeof signature === "string" ? Signature.fromString(signature) : signature;
  const parsedKey = typeof publicKey === "string" ? PublicKey.fromString(publicKey) : publicKey;
  return parsedSignature.verifyDigest(resolved.digest, parsedKey);
}

export function createSigningRequestCallback(
  resolved: ResolvedSigningRequest,
  context: SigningRequestCallbackContext,
): SigningRequestCallback | null {
  if (!resolved.callback) return null;
  if (!Array.isArray(context.signatures) || context.signatures.length === 0) {
    throw new TypeError("Signing-request callback requires at least one signature");
  }

  const signatures = context.signatures.map(signatureString);
  const payload: Record<string, string> = {
    ex: resolved.transaction.expiration,
    rbn: String(resolved.transaction.ref_block_num),
    req: resolved.request,
    sa: resolved.signer.actor,
    sp: resolved.signer.permission,
    sig: signatures[0]!,
    cid: resolved.chainId,
  };
  signatures.forEach((signature, index) => {
    payload[`sig${index}`] = signature;
  });
  if (context.blockNum !== undefined) payload.bn = String(context.blockNum);
  if (context.transactionId) payload.tx = context.transactionId;
  if (resolved.referenceBlockId) payload.rid = resolved.referenceBlockId;

  const url = resolved.callback.replace(/\{\{([a-z][a-z0-9]*)\}\}/gi, (token, key: string) => {
    const value = payload[key];
    return value === undefined ? token : encodeURIComponent(value);
  });
  return { url, background: resolved.background, payload };
}
