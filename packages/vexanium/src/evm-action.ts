/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { bigIntToName, nameToBigInt } from "@windstack/abi";
import { integer } from "@windstack/core";
import { VEX_EVM_ANTELOPE_CONTRACT } from "./constants.js";

type HexData = `0x${string}`;

export type VexEvmTransactionEvent =
  | Readonly<{
      type: "evmtx_v1";
      protocolVersion: bigint;
      rlpTransaction: HexData;
      baseFeePerGas: bigint;
    }>
  | Readonly<{
      type: "evmtx_v3";
      protocolVersion: bigint;
      rlpTransaction: HexData;
      overheadPrice: bigint;
      storagePrice: bigint;
    }>;

export type VexEvmContractAction =
  | Readonly<{
      contract: typeof VEX_EVM_ANTELOPE_CONTRACT;
      name: "evmtx";
      event: VexEvmTransactionEvent;
    }>
  | Readonly<{
      contract: typeof VEX_EVM_ANTELOPE_CONTRACT;
      name: "pushtx";
      miner: string;
      rlpTransaction: HexData;
      minInclusionPrice?: bigint;
    }>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function uint64(value: unknown, label: string): bigint {
  const result = integer(value as bigint | number | string, label);
  if (result < 0n || result > 0xffffffffffffffffn) {
    throw new RangeError(`${label} must fit in uint64`);
  }
  return result;
}

function canonicalAccount(value: unknown, label: string): string {
  if (typeof value !== "string" || !value || value.length > 12 || value.endsWith(".")) {
    throw new TypeError(`${label} must be a canonical Antelope account name`);
  }
  const encoded = nameToBigInt(value);
  if (bigIntToName(encoded) !== value) {
    throw new TypeError(`${label} must be a canonical Antelope account name`);
  }
  return value;
}

function rlpTransaction(value: unknown): HexData {
  if (typeof value !== "string") throw new TypeError("rlptx must be hexadecimal bytes");
  const raw = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (!raw || raw.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(raw)) {
    throw new TypeError("rlptx must be non-empty hexadecimal bytes");
  }
  if (raw.length > 4 * 1024 * 1024) throw new RangeError("rlptx exceeds the 2 MiB limit");
  return `0x${raw.toLowerCase()}`;
}

function transactionEvent(value: unknown): VexEvmTransactionEvent {
  if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== "string") {
    throw new TypeError("evmtx event must be a two-item ABI variant");
  }
  const payload = object(value[1], "evmtx event payload");
  const common = {
    protocolVersion: uint64(payload.eos_evm_version, "eos_evm_version"),
    rlpTransaction: rlpTransaction(payload.rlptx),
  };
  if (value[0] === "evmtx_v1") {
    return Object.freeze({
      type: "evmtx_v1",
      ...common,
      baseFeePerGas: uint64(payload.base_fee_per_gas, "base_fee_per_gas"),
    });
  }
  if (value[0] === "evmtx_v3") {
    return Object.freeze({
      type: "evmtx_v3",
      ...common,
      overheadPrice: uint64(payload.overhead_price, "overhead_price"),
      storagePrice: uint64(payload.storage_price, "storage_price"),
    });
  }
  throw new TypeError(`Unsupported vex.evm transaction event: ${value[0]}`);
}

/** Decode validated JSON action data from the production `vex.evm` transaction actions. */
export function decodeVexEvmContractAction(value: unknown): VexEvmContractAction {
  const outer = object(value, "VEX EVM action");
  const action = "act" in outer ? object(outer.act, "VEX EVM act") : outer;
  if (action.account !== VEX_EVM_ANTELOPE_CONTRACT) {
    throw new TypeError(`Action account must be ${VEX_EVM_ANTELOPE_CONTRACT}`);
  }
  const data = object(action.data, "VEX EVM action data");
  if (action.name === "evmtx") {
    return Object.freeze({
      contract: VEX_EVM_ANTELOPE_CONTRACT,
      name: "evmtx",
      event: transactionEvent(data.event),
    });
  }
  if (action.name === "pushtx") {
    const minimum = data.min_inclusion_price;
    return Object.freeze({
      contract: VEX_EVM_ANTELOPE_CONTRACT,
      name: "pushtx",
      miner: canonicalAccount(data.miner, "miner"),
      rlpTransaction: rlpTransaction(data.rlptx),
      ...(minimum === undefined || minimum === null
        ? {}
        : { minInclusionPrice: uint64(minimum, "min_inclusion_price") }),
    });
  }
  throw new TypeError(`Unsupported vex.evm transaction action: ${String(action.name)}`);
}
