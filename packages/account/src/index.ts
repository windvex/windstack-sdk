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

export type Authority = {
  threshold: number;
  keys: Array<{ key: string; weight: number }>;
  accounts: Array<{
    permission: { actor: string; permission: string };
    weight: number;
  }>;
  waits: Array<{ wait_sec: number; weight: number }>;
};

export type SystemActionOptions = {
  permission?: string;
};

function validateName(value: string, label: string): string {
  if (!value) throw new TypeError(`${label} is required`);
  nameToBigInt(value);
  return value;
}

function validateOptionalName(value: string, label: string): string {
  if (value) nameToBigInt(value);
  return value;
}

function validateLocation(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new RangeError("Producer location must be an integer between 0 and 65535");
  }
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
      throw new TypeError(
        "Token contract is required; configure it on the client or pass it explicitly",
      );
    }
    return this.rpc.getCurrencyBalance(
      validateName(tokenContract, "Token contract"),
      this.name,
      symbol,
      signal,
    );
  }

  contract(account: string): Contract {
    return new Contract(validateName(account, "Contract account"), this.rpc, this.abiCache);
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
      throw new TypeError(
        "Token contract is required; configure it on the client or pass tokenContract",
      );
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
      throw new TypeError(
        "System contract is required; configure it on the client before using system actions",
      );
    }
    return this.contract(this.systemContract).action(
      validateName(name, "System action"),
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

  buyRamSelf(quantity: string, signal?: AbortSignal): Promise<ContractAction> {
    return this.systemAction(
      "buyramself",
      { account: this.name, quant: quantity },
      "active",
      signal,
    );
  }

  buyRamBytes(receiver: string, bytes: number, signal?: AbortSignal): Promise<ContractAction> {
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 0xffffffff) {
      throw new RangeError("RAM bytes must be an integer between 1 and 4294967295");
    }
    return this.systemAction(
      "buyrambytes",
      { payer: this.name, receiver: validateName(receiver, "Receiver"), bytes },
      "active",
      signal,
    );
  }

  sellRam(bytes: number | bigint | string, signal?: AbortSignal): Promise<ContractAction> {
    let value: bigint;
    try {
      value = BigInt(bytes);
    } catch {
      throw new TypeError("RAM bytes must be an integer-compatible value");
    }
    if (value <= 0n || value > 0x7fffffffffffffffn) {
      throw new RangeError("RAM bytes must be a positive signed 64-bit integer");
    }
    return this.systemAction("sellram", { account: this.name, bytes: value }, "active", signal);
  }

  refund(signal?: AbortSignal): Promise<ContractAction> {
    return this.systemAction("refund", { owner: this.name }, "active", signal);
  }

  voteProducers(
    producers: string[],
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    if (!Array.isArray(producers) || producers.length === 0 || producers.length > 30) {
      throw new RangeError("Producer voting requires between 1 and 30 producers");
    }
    const normalized = producers.map((producer) => validateName(producer, "Producer"));
    if (new Set(normalized).size !== normalized.length) {
      throw new TypeError("Producer voting cannot contain duplicate accounts");
    }
    return this.systemAction(
      "voteproducer",
      { voter: this.name, proxy: "", producers: normalized },
      options.permission ?? "active",
      signal,
    );
  }

  voteProxy(
    proxy: string,
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "voteproducer",
      { voter: this.name, proxy: validateName(proxy, "Proxy"), producers: [] },
      options.permission ?? "active",
      signal,
    );
  }

  clearVote(options: SystemActionOptions = {}, signal?: AbortSignal): Promise<ContractAction> {
    return this.systemAction(
      "voteproducer",
      { voter: this.name, proxy: "", producers: [] },
      options.permission ?? "active",
      signal,
    );
  }

  registerProxy(
    isProxy = true,
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "regproxy",
      { proxy: this.name, isproxy: isProxy },
      options.permission ?? "active",
      signal,
    );
  }

  registerProducer(
    producerKey: string,
    url: string,
    location: number,
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    if (typeof url !== "string") throw new TypeError("Producer URL must be a string");
    return this.systemAction(
      "regproducer",
      {
        producer: this.name,
        producer_key: producerKey,
        url,
        location: validateLocation(location),
      },
      options.permission ?? "active",
      signal,
    );
  }

  unregisterProducer(
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "unregprod",
      { producer: this.name },
      options.permission ?? "active",
      signal,
    );
  }

  claimRewards(
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "claimrewards",
      { owner: this.name },
      options.permission ?? "active",
      signal,
    );
  }

  createAccount(
    accountName: string,
    owner: Authority,
    active: Authority,
    options: SystemActionOptions = {},
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "newaccount",
      {
        creator: this.name,
        name: validateName(accountName, "New account name"),
        owner,
        active,
      },
      options.permission ?? "active",
      signal,
    );
  }

  updatePermission(
    permission: string,
    parent: string,
    authority: Authority,
    authorizationPermission: string,
    authorizedBy?: string,
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "updateauth",
      {
        account: this.name,
        permission: validateName(permission, "Permission"),
        parent: validateOptionalName(parent, "Parent permission"),
        auth: authority,
        authorized_by: authorizedBy
          ? validateName(authorizedBy, "Authorized-by permission")
          : undefined,
      },
      validateName(authorizationPermission, "Authorization permission"),
      signal,
    );
  }

  deletePermission(
    permission: string,
    authorizationPermission: string,
    authorizedBy?: string,
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "deleteauth",
      {
        account: this.name,
        permission: validateName(permission, "Permission"),
        authorized_by: authorizedBy
          ? validateName(authorizedBy, "Authorized-by permission")
          : undefined,
      },
      validateName(authorizationPermission, "Authorization permission"),
      signal,
    );
  }

  linkPermission(
    code: string,
    action: string,
    requirement: string,
    authorizationPermission: string,
    authorizedBy?: string,
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "linkauth",
      {
        account: this.name,
        code: validateName(code, "Contract"),
        type: validateOptionalName(action, "Action"),
        requirement: validateName(requirement, "Required permission"),
        authorized_by: authorizedBy
          ? validateName(authorizedBy, "Authorized-by permission")
          : undefined,
      },
      validateName(authorizationPermission, "Authorization permission"),
      signal,
    );
  }

  unlinkPermission(
    code: string,
    action: string,
    authorizationPermission: string,
    authorizedBy?: string,
    signal?: AbortSignal,
  ): Promise<ContractAction> {
    return this.systemAction(
      "unlinkauth",
      {
        account: this.name,
        code: validateName(code, "Contract"),
        type: validateOptionalName(action, "Action"),
        authorized_by: authorizedBy
          ? validateName(authorizedBy, "Authorized-by permission")
          : undefined,
      },
      validateName(authorizationPermission, "Authorization permission"),
      signal,
    );
  }
}
