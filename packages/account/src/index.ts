/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { AbiCache, Contract, type ContractAction } from "@windstack/contract";
import { RpcClient } from "@windstack/rpc";

export class AccountClient {
  readonly name: string; readonly rpc: RpcClient; readonly abiCache: AbiCache;
  constructor(name: string, rpc: RpcClient, abiCache = new AbiCache()) { this.name = name; this.rpc = rpc; this.abiCache = abiCache; }
  get<T = Record<string, unknown>>(signal?: AbortSignal): Promise<T> { return this.rpc.getAccount<T>(this.name, signal); }
  balance(tokenContract = "eosio.token", symbol?: string, signal?: AbortSignal): Promise<string[]> { return this.rpc.getCurrencyBalance(tokenContract, this.name, symbol, signal); }
  contract(account: string): Contract { return new Contract(account, this.rpc, this.abiCache); }
  async transfer(to: string, quantity: string, memo = "", options: { tokenContract?: string; permission?: string } = {}, signal?: AbortSignal): Promise<ContractAction> {
    const token = this.contract(options.tokenContract ?? "eosio.token");
    return token.action("transfer", { from: this.name, to, quantity, memo }, [`${this.name}@${options.permission ?? "active"}`], signal);
  }
  systemAction(name: string, data: unknown, permission = "active", signal?: AbortSignal): Promise<ContractAction> { return this.contract("eosio").action(name, data, [`${this.name}@${permission}`], signal); }
  delegate(receiver: string, stakeNetQuantity: string, stakeCpuQuantity: string, transfer = false, signal?: AbortSignal): Promise<ContractAction> { return this.systemAction("delegatebw", { from: this.name, receiver, stake_net_quantity: stakeNetQuantity, stake_cpu_quantity: stakeCpuQuantity, transfer }, "active", signal); }
  undelegate(receiver: string, unstakeNetQuantity: string, unstakeCpuQuantity: string, signal?: AbortSignal): Promise<ContractAction> { return this.systemAction("undelegatebw", { from: this.name, receiver, unstake_net_quantity: unstakeNetQuantity, unstake_cpu_quantity: unstakeCpuQuantity }, "active", signal); }
  buyRamBytes(receiver: string, bytes: number, signal?: AbortSignal): Promise<ContractAction> { return this.systemAction("buyrambytes", { payer: this.name, receiver, bytes }, "active", signal); }
  sellRam(bytes: number, signal?: AbortSignal): Promise<ContractAction> { return this.systemAction("sellram", { account: this.name, bytes }, "active", signal); }
}
