/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { nameToBigInt } from "@windstack/abi";
import { AbiCache, Contract, type ContractAction } from "@windstack/contract";
import { RpcClient } from "@windstack/rpc";

export type AccountClientOptions = {
  tokenContract?: string;
  systemContract?: string;
};

function validateName(value: string, label: string): string {
  if (!value) throw new TypeError(`${label} is required`);
  nameToBigInt(value);
  return value;
}

export class AccountClient {
  readonly name: string;
  readonly rpc: RpcClient;
  readonly abiCache: AbiCache;
  readonly tokenContract?: string;
  readonly systemContract?: string;

  constructor(
    name: string,
    rpc: RpcClient,
    abiCache = new AbiCache(),
    options: AccountClientOptions = {},
  ) {
    this.name = validateName(name, "Account name");
    this.rpc = rpc;
    this.abiCache = abiCache;
    this.tokenContract = options.tokenContract
      ? validateName(options.tokenContract, "Token contract")
      : undefined;
    this.systemContract = options.systemContract
      ? validateName(options.systemContract, "System contract")
      : undefined;
  }

  get<T = Record<string, unknown>>(signal?: AbortSignal): Promise<T> {
    return this.rpc.getAccount<T>(this.name, signal);
  }

  balance(
    tokenContract = this.tokenContract,
    symbol?: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    if (!tokenContract) {
      throw new TypeError("Token contract is required; configure it on the client or pass it explicitly");
    }
    return this.rpc.getCurrencyBalance(
      validateName(tokenContract, "Token contract"),
      this.name,
      symbol,
      signal,
    );
  }

  contract(account: string): Contract {
    return new Contract(account, this.rpc, this.abiCache);
  }

  async transfer(
    to: string,
    quantity: string,
    memo = "",
    options: { tokenContract?: string; permission?: string } = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    const tokenContract = options.tokenContract ?? this.tokenContract;
    if (!tokenContract) {
      throw new TypeError("Token contract is required; configure it on the client or pass tokenContract");
    }
    const permission = validateName(options.permission ?? "active", "Permission");
    return this.contract(tokenContract).action(
      "transfer",
      { from: this.name, to: validateName(to, "Transfer recipient"), quantity, memo },
      [`${this.name}@${permission}`],
      signal,
    );
  }

  systemAction(
    name: string,
    data: unknown,
    permission = "active",
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    if (!this.systemContract) {
      throw new TypeError("System contract is required; configure it on the client before using system actions");
    }
    return this.contract(this.systemContract).action(
      name,
      data,
      [`${this.name}@${validateName(permission, "Permission")}`],
      signal,
    );
  }

  delegate(
    receiver: string,
    stakeNetQuantity: string,
    stakeCpuQuantity: string,
    transfer = false,
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "delegatebw",
      {
        from: this.name,
        receiver: validateName(receiver, "Receiver"),
        stake_net_quantity: stakeNetQuantity,
        stake_cpu_quantity: stakeCpuQuantity,
        transfer,
      },
      "active",
      signal,
    );
  }

  undelegate(
    receiver: string,
    unstakeNetQuantity: string,
    unstakeCpuQuantity: string,
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "undelegatebw",
      {
        from: this.name,
        receiver: validateName(receiver, "Receiver"),
        unstake_net_quantity: unstakeNetQuantity,
        unstake_cpu_quantity: unstakeCpuQuantity,
      },
      "active",
      signal,
    );
  }

  buyRam(receiver: string, quantity: string, signal?: AbortSignal): Promise<ContractAction> {
    return this.systemAction(
      "buyram",
      { payer: this.name, receiver: validateName(receiver, "Receiver"), quant: quantity },
      "active",
      signal,
    );
  }

  buyRamBytes(receiver: string, bytes: number, signal?: AbortSignal): Promise<ContractAction> {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) {
      throw new RangeError("RAM bytes must be a positive safe integer");
    }
    return this.systemAction(
      "buyrambytes",
      { payer: this.name, receiver: validateName(receiver, "Receiver"), bytes },
      "active",
      signal,
    );
  }

  sellRam(bytes: number, signal?: AbortSignal): Promise<ContractAction> {
    if (!Number.isSafeInteger(bytes) || bytes <= 0) {
      throw new RangeError("RAM bytes must be a positive safe integer");
    }
    return this.systemAction("sellram", { account: this.name, bytes }, "active", signal);
  }

  refund(signal?: AbortSignal): Promise<ContractAction> {
    return this.systemAction("refund", { owner: this.name }, "active", signal);
  }
}
