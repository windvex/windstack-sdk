import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  EIP6963_ANNOUNCE_PROVIDER_EVENT,
  EIP6963_REQUEST_PROVIDER_EVENT,
  EVM_METHODS,
  EVM_PROVIDER_GLOBAL,
  WISP_EVM_PROVIDER_RDNS,
} from "../packages/evm/dist/index.js";
import {
  VEXANIUM_ANNOUNCE_PROVIDER_EVENT,
  VEXANIUM_CAPABILITIES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_MAINNET_SCOPE,
  VEXANIUM_METHODS,
  VEXANIUM_PROVIDER_GLOBAL,
  VEXANIUM_PROVIDER_STANDARD,
  VEXANIUM_PROVIDER_VERSION,
  VEXANIUM_REQUEST_PROVIDER_EVENT,
  WISP_PROVIDER_RDNS,
} from "../packages/vexanium/dist/index.js";

const contract = JSON.parse(
  await readFile(
    new URL("../specs/wisp-provider-contract.json", import.meta.url),
    "utf8",
  ),
);

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.provider.name, "Wisp");
assert.equal(contract.provider.rdns, WISP_PROVIDER_RDNS);
assert.equal(contract.provider.rdns, WISP_EVM_PROVIDER_RDNS);

assert.equal(contract.vex.global, VEXANIUM_PROVIDER_GLOBAL);
assert.equal(contract.vex.standard, VEXANIUM_PROVIDER_STANDARD);
assert.equal(contract.vex.version, VEXANIUM_PROVIDER_VERSION);
assert.equal(contract.vex.chainId, VEXANIUM_MAINNET_CHAIN_ID);
assert.equal(contract.vex.scope, VEXANIUM_MAINNET_SCOPE);
assert.deepEqual(contract.vex.capabilities, Object.values(VEXANIUM_CAPABILITIES));
assert.deepEqual(Object.values(contract.vex.methods), Object.values(VEXANIUM_METHODS));
assert.equal(
  contract.vex.events.requestProvider,
  VEXANIUM_REQUEST_PROVIDER_EVENT,
);
assert.equal(
  contract.vex.events.announceProvider,
  VEXANIUM_ANNOUNCE_PROVIDER_EVENT,
);

assert.equal(contract.evm.global, EVM_PROVIDER_GLOBAL);
assert.equal(contract.evm.chainId, 6736);
assert.equal(contract.evm.chainIdHex, "0x1a50");
assert.deepEqual(Object.values(contract.evm.methods), Object.values(EVM_METHODS));
assert.equal(
  contract.evm.events.requestProvider,
  EIP6963_REQUEST_PROVIDER_EVENT,
);
assert.equal(
  contract.evm.events.announceProvider,
  EIP6963_ANNOUNCE_PROVIDER_EVENT,
);

console.log("Canonical Wisp provider specification: PASS");
