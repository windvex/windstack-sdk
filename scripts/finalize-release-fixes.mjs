/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { readFile, writeFile } from "node:fs/promises";

async function edit(path, mutate) {
  const source = await readFile(path, "utf8");
  const next = mutate(source);
  if (next === source) throw new Error(`No changes produced for ${path}`);
  await writeFile(path, next);
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing replacement target: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Replacement target is not unique: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

await edit("packages/signing-request/src/types.ts", (source) =>
  replaceOnce(
    source,
    "export type SigningRequestIdentity = {\n  scope: string;\n  permission?: SigningRequestPermissionLevel | null;\n};",
    "export type SigningRequestIdentity = {\n  /** Revision 3 scope. Revision 2 identity requests do not carry this field. */\n  scope?: string;\n  permission?: SigningRequestPermissionLevel | null;\n};",
    "optional Revision 2 identity scope",
  ),
);

await edit("packages/signing-request/src/request.ts", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    'import { SIGNING_REQUEST_ABI } from "./schema.js";',
    'import { SIGNING_REQUEST_ABI, SIGNING_REQUEST_ABI_V2 } from "./schema.js";',
    "request schema imports",
  );
  source = replaceOnce(
    source,
    "const serializer = new AbiSerializer(SIGNING_REQUEST_ABI);\nconst REQUEST_SIGNATURE_WIRE_BYTES = 74;",
    "const serializer = new AbiSerializer(SIGNING_REQUEST_ABI);\nconst serializerV2 = new AbiSerializer(SIGNING_REQUEST_ABI_V2);\nconst REQUEST_SIGNATURE_WIRE_BYTES = 74;\n\nfunction serializerForVersion(version: number): AbiSerializer {\n  return version === 2 ? serializerV2 : serializer;\n}",
    "versioned request serializer",
  );
  source = replaceOnce(
    source,
    "function cloneData(data: SigningRequestData): SigningRequestData {\n  return structuredClone(data);\n}\n\nfunction toAbiData(data: SigningRequestData): Record<string, unknown> {\n  return {\n    chain_id: { type: data.chainId.type, value: data.chainId.value },\n    req: { type: data.request.type, value: data.request.value },\n    flags: data.flags,\n    callback: data.callback,\n    info: data.info,\n  };\n}\n\nfunction fromAbiData(value: unknown): SigningRequestData {",
    'function clonePermissionLevel(\n  value: SigningRequestPermissionLevel,\n): SigningRequestPermissionLevel {\n  return { actor: value.actor, permission: value.permission };\n}\n\nfunction cloneAction(value: SigningRequestAction): SigningRequestAction {\n  return {\n    account: value.account,\n    name: value.name,\n    authorization: value.authorization.map(clonePermissionLevel),\n    data: value.data,\n  };\n}\n\nfunction cloneTransaction(value: SigningRequestTransaction): SigningRequestTransaction {\n  return {\n    expiration: value.expiration,\n    ref_block_num: value.ref_block_num,\n    ref_block_prefix: value.ref_block_prefix,\n    max_net_usage_words: value.max_net_usage_words,\n    max_cpu_usage_ms: value.max_cpu_usage_ms,\n    delay_sec: value.delay_sec,\n    context_free_actions: value.context_free_actions.map(cloneAction),\n    actions: value.actions.map(cloneAction),\n    transaction_extensions: value.transaction_extensions.map((extension) => ({ ...extension })),\n  };\n}\n\nfunction clonePayload(value: SigningRequestPayload): SigningRequestPayload {\n  switch (value.type) {\n    case "action":\n      return { type: value.type, value: cloneAction(value.value) };\n    case "action[]":\n      return { type: value.type, value: value.value.map(cloneAction) };\n    case "transaction":\n      return { type: value.type, value: cloneTransaction(value.value) };\n    case "identity":\n      return {\n        type: value.type,\n        value: {\n          ...(value.value.scope !== undefined ? { scope: value.value.scope } : {}),\n          permission: value.value.permission\n            ? clonePermissionLevel(value.value.permission)\n            : value.value.permission ?? null,\n        },\n      };\n  }\n}\n\nfunction cloneData(data: SigningRequestData): SigningRequestData {\n  return {\n    chainId: { ...data.chainId },\n    request: clonePayload(data.request),\n    flags: data.flags,\n    callback: data.callback,\n    info: data.info.map((pair) => ({ ...pair })),\n  };\n}\n\nfunction toAbiData(data: SigningRequestData, version: number): Record<string, unknown> {\n  const requestValue =\n    version === 2 && data.request.type === "identity"\n      ? { permission: data.request.value.permission ?? null }\n      : data.request.value;\n  return {\n    chain_id: { type: data.chainId.type, value: data.chainId.value },\n    req: { type: data.request.type, value: requestValue },\n    flags: data.flags,\n    callback: data.callback,\n    info: data.info,\n  };\n}\n\nfunction fromAbiData(value: unknown, version: number): SigningRequestData {',
    "portable signing-request clone and versioned ABI conversion",
  );
  source = replaceOnce(
    source,
    '  const chainId: SigningRequestChain =\n    chain.type === "chain_alias"\n      ? { type: "chain_alias", value: Number(chain.value) }\n      : { type: "chain_id", value: String(chain.value).toLowerCase() };\n  return {\n    chainId,\n    request: {\n      type: request.type,\n      value: request.value,\n    } as SigningRequestPayload,',
    '  const chainId: SigningRequestChain =\n    chain.type === "chain_alias"\n      ? { type: "chain_alias", value: Number(chain.value) }\n      : { type: "chain_id", value: String(chain.value).toLowerCase() };\n  const requestType = String(request.type) as SigningRequestPayload["type"];\n  const requestValue =\n    version === 2 && requestType === "identity"\n      ? {\n          permission:\n            request.value && typeof request.value === "object"\n              ? ((request.value as { permission?: SigningRequestPermissionLevel | null }).permission ??\n                null)\n              : null,\n        }\n      : request.value;\n  return {\n    chainId,\n    request: {\n      type: requestType,\n      value: requestValue,\n    } as SigningRequestPayload,',
    "Revision 2 identity normalization",
  );
  source = replaceOnce(
    source,
    '    let data: SigningRequestData;\n    let requestSignature: SigningRequestSignature | null = null;\n    try {\n      data = fromAbiData(serializer.decode("signing_request", payload));\n    } catch (unsignedError) {\n      if (payload.length <= REQUEST_SIGNATURE_WIRE_BYTES) throw unsignedError;\n      const body = payload.slice(0, -REQUEST_SIGNATURE_WIRE_BYTES);\n      const signatureBytes = payload.slice(-REQUEST_SIGNATURE_WIRE_BYTES);\n      data = fromAbiData(serializer.decode("signing_request", body));\n      const decodedSignature = serializer.decode("request_signature", signatureBytes) as {',
    '    const bodySerializer = serializerForVersion(version);\n    let data: SigningRequestData;\n    let requestSignature: SigningRequestSignature | null = null;\n    try {\n      data = fromAbiData(bodySerializer.decode("signing_request", payload), version);\n    } catch (unsignedError) {\n      if (payload.length <= REQUEST_SIGNATURE_WIRE_BYTES) throw unsignedError;\n      const body = payload.slice(0, -REQUEST_SIGNATURE_WIRE_BYTES);\n      const signatureBytes = payload.slice(-REQUEST_SIGNATURE_WIRE_BYTES);\n      data = fromAbiData(bodySerializer.decode("signing_request", body), version);\n      const decodedSignature = bodySerializer.decode("request_signature", signatureBytes) as {',
    "versioned request decode",
  );
  source = replaceOnce(
    source,
    '  serializeBody(): Uint8Array {\n    return serializer.encode("signing_request", toAbiData(this.#data));\n  }',
    '  serializeBody(): Uint8Array {\n    return serializerForVersion(this.version).encode(\n      "signing_request",\n      toAbiData(this.#data, this.version),\n    );\n  }',
    "versioned request encode",
  );
  return source;
});

await edit("packages/signing-request/src/resolution.ts", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    'import { SIGNING_REQUEST_ABI } from "./schema.js";',
    'import { SIGNING_REQUEST_ABI, SIGNING_REQUEST_ABI_V2 } from "./schema.js";',
    "resolution schema imports",
  );
  source = replaceOnce(
    source,
    "const requestSerializer = new AbiSerializer(SIGNING_REQUEST_ABI);\nconst MAX_PLACEHOLDER_DEPTH = 100;",
    "const requestSerializer = new AbiSerializer(SIGNING_REQUEST_ABI);\nconst requestSerializerV2 = new AbiSerializer(SIGNING_REQUEST_ABI_V2);\nconst MAX_PLACEHOLDER_DEPTH = 100;",
    "Revision 2 identity serializer",
  );
  source = replaceOnce(
    source,
    "    permission:\n      value.permission === SIGNING_REQUEST_PLACEHOLDER_PERMISSION\n        ? signer.permission\n        : value.permission,",
    "    permission:\n      value.permission === SIGNING_REQUEST_PLACEHOLDER_PERMISSION ||\n      value.permission === SIGNING_REQUEST_PLACEHOLDER_ACTOR\n        ? signer.permission\n        : value.permission,",
    "legacy authorization placeholder compatibility",
  );
  source = replaceOnce(
    source,
    'function createIdentityTransaction(\n  identity: SigningRequestIdentity,\n  signer: SigningRequestPermissionLevel,\n  tapos: SigningRequestTapos | undefined,\n): SigningRequestTransaction {\n  if (!tapos) throw new TypeError("Identity proof resolution requires an expiration context");\n  if (\n    identity.permission &&\n    (identity.permission.actor !== signer.actor ||\n      identity.permission.permission !== signer.permission)\n  ) {\n    throw new TypeError(\n      "Selected signer does not match the permission requested by the identity request",\n    );\n  }\n  const data = bytesToHex(\n    requestSerializer.encode("identity", {\n      scope: identity.scope,\n      permission: signer,\n    }),\n  );\n  return {\n    expiration: tapos.expiration,\n    ref_block_num: 0,\n    ref_block_prefix: 0,\n    max_net_usage_words: 0,\n    max_cpu_usage_ms: 0,\n    delay_sec: 0,\n    context_free_actions: [],\n    actions: [\n      {\n        account: "",\n        name: "identity",\n        authorization: [signer],\n        data,\n      },\n    ],\n    transaction_extensions: [],\n  };\n}',
    'function createIdentityTransaction(\n  version: number,\n  identity: SigningRequestIdentity,\n  signer: SigningRequestPermissionLevel,\n  tapos: SigningRequestTapos | undefined,\n): SigningRequestTransaction {\n  if (version > 2 && !tapos) {\n    throw new TypeError("Revision 3 identity proof resolution requires an expiration context");\n  }\n  if (\n    identity.permission &&\n    (identity.permission.actor !== signer.actor ||\n      identity.permission.permission !== signer.permission)\n  ) {\n    throw new TypeError(\n      "Selected signer does not match the permission requested by the identity request",\n    );\n  }\n  const serializer = version === 2 ? requestSerializerV2 : requestSerializer;\n  const identityValue =\n    version === 2\n      ? { permission: signer }\n      : {\n          scope: validateName(identity.scope ?? "", "Identity scope"),\n          permission: signer,\n        };\n  const data = bytesToHex(serializer.encode("identity", identityValue));\n  return {\n    expiration: version === 2 ? "1970-01-01T00:00:00" : tapos!.expiration,\n    ref_block_num: 0,\n    ref_block_prefix: 0,\n    max_net_usage_words: 0,\n    max_cpu_usage_ms: 0,\n    delay_sec: 0,\n    context_free_actions: [],\n    actions: [\n      {\n        account: "",\n        name: "identity",\n        authorization: [signer],\n        data,\n      },\n    ],\n    transaction_extensions: [],\n  };\n}',
    "Revision 2 and 3 identity resolution",
  );
  source = replaceOnce(
    source,
    "    transaction = createIdentityTransaction(payload.value, signer, options.tapos);",
    "    transaction = createIdentityTransaction(request.version, payload.value, signer, options.tapos);",
    "versioned identity transaction call",
  );
  return source;
});

await edit("packages/account/src/index.ts", (source) =>
  replaceOnce(
    source,
    '    const normalized = producers.map((producer) => validateName(producer, "Producer"));\n    if (new Set(normalized).size !== normalized.length) {\n      throw new TypeError("Producer voting cannot contain duplicate accounts");\n    }\n    return this.systemAction(\n      "voteproducer",\n      { voter: this.name, proxy: "", producers: normalized },',
    '    const normalized = producers.map((producer) => validateName(producer, "Producer"));\n    if (new Set(normalized).size !== normalized.length) {\n      throw new TypeError("Producer voting cannot contain duplicate accounts");\n    }\n    normalized.sort((left, right) => {\n      const a = nameToBigInt(left);\n      const b = nameToBigInt(right);\n      return a < b ? -1 : a > b ? 1 : 0;\n    });\n    return this.systemAction(\n      "voteproducer",\n      { voter: this.name, proxy: "", producers: normalized },',
    "canonical producer voting order",
  ),
);

await edit("packages/abi/src/index.ts", (source) =>
  replaceOnce(
    source,
    '      case "bytes":\n        writer.writeVarBytes(\n          typeof value === "string"\n            ? hexToBytes(value)\n            : assertHexBytes(value, (value as Uint8Array).length, type),\n        );\n        return;',
    '      case "bytes":\n        if (typeof value === "string") {\n          writer.writeVarBytes(hexToBytes(value));\n          return;\n        }\n        if (!(value instanceof Uint8Array)) {\n          throw new TypeError("bytes expects hexadecimal or Uint8Array");\n        }\n        writer.writeVarBytes(value);\n        return;',
    "strict ABI bytes input",
  ),
);

await edit("scripts/test-signing-request.mjs", (source) =>
  replaceOnce(
    source,
    'assert.throws(\n  () => SigningRequest.from(`vsr:${Buffer.from(Uint8Array.of(4, 0)).toString("base64url")}`),\n  /Unsupported signing-request protocol version/,\n);\n\nassert.equal(bytesToHex(resolved.digest).length, 64);',
    'assert.throws(\n  () => SigningRequest.from(`vsr:${Buffer.from(Uint8Array.of(4, 0)).toString("base64url")}`),\n  /Unsupported signing-request protocol version/,\n);\n\nconst revision2IdentityUri =\n  "esr://AgABAwACJWh0dHBzOi8vY2guYW5jaG9yLmxpbmsvMTIzNC00NTY3LTg5MDAA";\nconst revision2Identity = SigningRequest.from(revision2IdentityUri);\nassert.equal(revision2Identity.version, 2);\nassert.equal(revision2Identity.isIdentity, true);\nassert.equal(revision2Identity.data.request.type, "identity");\nassert.equal(revision2Identity.data.request.value.scope, undefined);\nassert.equal(revision2Identity.encode(false, true, "esr"), revision2IdentityUri);\nconst revision2Resolved = await resolveSigningRequest(revision2Identity, {\n  actor: "windstack",\n  permission: "active",\n  abiProvider,\n});\nassert.equal(revision2Resolved.transaction.expiration, "1970-01-01T00:00:00");\nassert.equal(revision2Resolved.transaction.ref_block_num, 0);\nassert.equal(revision2Resolved.transaction.ref_block_prefix, 0);\nassert.deepEqual(revision2Resolved.transaction.actions[0].authorization, [\n  { actor: "windstack", permission: "active" },\n]);\nconst revision2IdentityData = new AbiSerializer(SIGNING_REQUEST_ABI).decode(\n  "permission_level",\n  Uint8Array.from(\n    revision2Resolved.transaction.actions[0].data\n      .slice(2)\n      .match(/.{2}/g)\n      .map((value) => Number.parseInt(value, 16)),\n  ),\n);\nassert.deepEqual(revision2IdentityData, { actor: "windstack", permission: "active" });\n\nconst legacyPermissionRequest = await SigningRequest.create(\n  {\n    chainId: VEX_CHAIN_ID,\n    action: {\n      account: "vex.token",\n      name: "transfer",\n      authorization: [\n        {\n          actor: SIGNING_REQUEST_PLACEHOLDER_ACTOR,\n          permission: SIGNING_REQUEST_PLACEHOLDER_ACTOR,\n        },\n      ],\n      data: {\n        from: SIGNING_REQUEST_PLACEHOLDER_ACTOR,\n        to: "receiver",\n        quantity: "1.0000 VEX",\n        memo: "legacy placeholder",\n      },\n    },\n  },\n  { abiProvider },\n);\nconst legacyPermissionResolved = await resolveSigningRequest(legacyPermissionRequest, {\n  actor: "windstack",\n  permission: "active",\n  abiProvider,\n  tapos: {\n    expiration: "2026-09-07T04:00:00",\n    refBlockNum: 1,\n    refBlockPrefix: 2,\n  },\n});\nassert.deepEqual(legacyPermissionResolved.transaction.actions[0].authorization, [\n  { actor: "windstack", permission: "active" },\n]);\n\nconst exposed = request.data;\nexposed.callback = "https://mutated.invalid";\nexposed.info.push({ key: "mutated", value: "00" });\nif (exposed.request.type === "action") exposed.request.value.data = "00";\nassert.notEqual(request.data.callback, exposed.callback);\nassert.equal(request.getInfo("mutated"), null);\nassert.notEqual(request.data.request.type === "action" ? request.data.request.value.data : "", "00");\n\nassert.equal(bytesToHex(resolved.digest).length, 64);',
    "Revision 2 identity and immutable request regression tests",
  ),
);

await edit("scripts/test-contract-account.mjs", (initial) => {
  let source = initial;
  source = replaceOnce(
    source,
    'import { AbiSerializer, hexToBytes } from "../packages/abi/dist/index.js";',
    'import { AbiSerializer, hexToBytes, nameToBigInt } from "../packages/abi/dist/index.js";',
    "account test name ordering import",
  );
  source = replaceOnce(
    source,
    'assert.equal(actions[14].name, "regproxy");\n\nassert.throws(() => account.voteProducers(["alice", "alice"]), /duplicate/);',
    'assert.equal(actions[14].name, "regproxy");\n\nconst unorderedProducers = ["bob", "alice"];\nconst sortedVote = await account.voteProducers(unorderedProducers);\nconst decodedVote = systemSerializer.decodeAction("voteproducer", hexToBytes(sortedVote.data));\nconst expectedProducerOrder = [...unorderedProducers].sort((left, right) => {\n  const a = nameToBigInt(left);\n  const b = nameToBigInt(right);\n  return a < b ? -1 : a > b ? 1 : 0;\n});\nassert.deepEqual(decodedVote.producers, expectedProducerOrder);\n\nassert.throws(() => account.voteProducers(["alice", "alice"]), /duplicate/);',
    "producer canonical ordering regression test",
  );
  return source;
});

await edit("scripts/test-abi.mjs", (source) =>
  replaceOnce(
    source,
    'assert.throws(() => serializer.encode("uint8", 256), /uint8/);\nassert.throws(() => parseAsset("01.0000 VEX"), /Invalid asset/);',
    'assert.throws(() => serializer.encode("uint8", 256), /uint8/);\nassert.throws(() => serializer.encode("bytes", null), /hexadecimal or Uint8Array/);\nassert.throws(() => serializer.encode("bytes", { length: 2 }), /hexadecimal or Uint8Array/);\nassert.throws(() => parseAsset("01.0000 VEX"), /Invalid asset/);',
    "strict bytes regression tests",
  ),
);

console.log("Final release compatibility fixes applied");
