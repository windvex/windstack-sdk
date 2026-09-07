import {
  PROVIDER_ERROR_CODES,
  ProviderRpcError,
  invalidParams,
  normalizeProviderRpcError,
} from "@windstack/core";
import type { RequestArguments } from "@windstack/core";
import { EVM_METHODS } from "./constants.js";
import { getEVMProvider, getInjectedEVMProvider } from "./discovery.js";
import type {
  AddEthereumChainParameter,
  EIP1193Provider,
  EVMClient,
  EVMClientOptions,
  EVMProviderEventMap,
} from "./types.js";
import { normalizeEvmAddress, normalizeEvmChainId } from "./address.js";

const HEX_CHAIN_ID_PATTERN = /^0x(?:0|[1-9a-f][0-9a-f]*)$/i;

function assertHexChainId(chainId: string): void {
  if (typeof chainId !== "string" || !HEX_CHAIN_ID_PATTERN.test(chainId)) {
    throw invalidParams("EVM chainId must be a canonical 0x-prefixed hexadecimal integer", {
      chainId,
    });
  }
}

function assertSecureUrls(values: string[] | undefined, field: string): void {
  if (!values) return;
  if (!Array.isArray(values) || values.length === 0)
    throw invalidParams(`${field} must be a non-empty array`);
  for (const value of values) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("Unsupported URL");
      }
    } catch {
      throw invalidParams(`${field} must contain valid HTTPS URLs`, { value });
    }
  }
}

function assertAddChainParams(params: AddEthereumChainParameter): void {
  if (typeof params !== "object" || params === null)
    throw invalidParams("Chain parameters are required");
  assertHexChainId(params.chainId);
  assertSecureUrls(params.rpcUrls, "rpcUrls");
  assertSecureUrls(params.blockExplorerUrls, "blockExplorerUrls");
  assertSecureUrls(params.iconUrls, "iconUrls");
  if (params.nativeCurrency && !Number.isInteger(params.nativeCurrency.decimals)) {
    throw invalidParams("nativeCurrency.decimals must be a non-negative integer");
  }
  if (params.nativeCurrency && params.nativeCurrency.decimals < 0) {
    throw invalidParams("nativeCurrency.decimals must be a non-negative integer");
  }
  if (
    params.nativeCurrency &&
    (!params.nativeCurrency.name?.trim() || !params.nativeCurrency.symbol?.trim())
  ) {
    throw invalidParams("nativeCurrency name and symbol are required");
  }
}

function normalizeAccountsResponse(value: unknown): `0x${string}`[] {
  if (!Array.isArray(value) || value.length > 1000) {
    throw invalidParams("Provider returned malformed accounts");
  }
  let accounts: `0x${string}`[];
  try {
    accounts = value.map((account) => {
      if (typeof account !== "string") throw new TypeError("Invalid account");
      return normalizeEvmAddress(account);
    });
  } catch {
    throw invalidParams("Provider returned malformed accounts");
  }
  if (new Set(accounts).size !== accounts.length) {
    throw invalidParams("Provider returned duplicate accounts");
  }
  return accounts;
}

export async function createEVMClient(options: EVMClientOptions = {}): Promise<EVMClient> {
  let provider: EIP1193Provider | null =
    options.provider ??
    (await getEVMProvider({
      timeoutMs: options.discoveryTimeoutMs,
      preferredRdns: options.preferredRdns,
    }));

  const requireProvider = (): EIP1193Provider => {
    provider = provider ?? getInjectedEVMProvider();
    if (!provider?.request) {
      throw new ProviderRpcError(
        PROVIDER_ERROR_CODES.INTERNAL_ERROR,
        "No EVM provider is available",
      );
    }
    return provider;
  };

  const request = async <TResult = unknown, TParams = unknown>(
    args: RequestArguments<TParams>,
  ): Promise<TResult> => {
    try {
      return await requireProvider().request<TResult, TParams>(args);
    } catch (error) {
      throw normalizeProviderRpcError(error);
    }
  };

  return {
    isAvailable() {
      return Boolean(provider?.request || getInjectedEVMProvider()?.request);
    },
    getProvider() {
      provider = provider ?? getInjectedEVMProvider();
      return provider;
    },
    request,
    async connect() {
      const accounts = await request<unknown>({ method: EVM_METHODS.REQUEST_ACCOUNTS });
      return normalizeAccountsResponse(accounts);
    },
    async getAccounts() {
      const accounts = await request<unknown>({ method: EVM_METHODS.GET_ACCOUNTS });
      return normalizeAccountsResponse(accounts);
    },
    async getChainId() {
      try {
        return normalizeEvmChainId(await request<string>({ method: EVM_METHODS.GET_CHAIN_ID }));
      } catch (error) {
        if (error instanceof ProviderRpcError) throw error;
        throw invalidParams("Provider returned a malformed chain ID");
      }
    },
    async switchChain(chainId: string) {
      assertHexChainId(chainId);
      return await request({ method: EVM_METHODS.SWITCH_CHAIN, params: [{ chainId }] });
    },
    async addChain(params: AddEthereumChainParameter) {
      assertAddChainParams(params);
      return await request({ method: EVM_METHODS.ADD_CHAIN, params: [params] });
    },
    on<TEvent extends keyof EVMProviderEventMap>(
      event: TEvent,
      handler: (payload: EVMProviderEventMap[TEvent]) => void,
    ) {
      requireProvider().on(event, handler);
    },
    off<TEvent extends keyof EVMProviderEventMap>(
      event: TEvent,
      handler: (payload: EVMProviderEventMap[TEvent]) => void,
    ) {
      const current = requireProvider();
      if (current.off) current.off(event, handler);
      else current.removeListener?.(event, handler);
    },
  };
}
