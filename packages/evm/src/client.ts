import { WISP_ERROR_CODES, WispProviderError, normalizeProviderError } from "@windstack/core";
import type { RequestArguments } from "@windstack/core";
import { EVM_METHODS } from "./constants.js";
import { getEVMProvider, getInjectedEVMProvider } from "./discovery.js";
import type { EIP1193Provider, EVMClient, EVMClientOptions, EVMProviderEventMap } from "./types.js";

export async function createEVMClient(options: EVMClientOptions = {}): Promise<EVMClient> {
  let provider: EIP1193Provider | null = options.provider ?? await getEVMProvider(options.discoveryTimeoutMs);

  const requireProvider = (): EIP1193Provider => {
    provider = provider ?? getInjectedEVMProvider();
    if (!provider?.request) {
      throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, "No EVM provider is available");
    }
    return provider;
  };

  const request = async <TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult> => {
    try {
      return await requireProvider().request<TResult, TParams>(args);
    } catch (error) {
      throw normalizeProviderError(error);
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
    connect() {
      return request<string[]>({ method: EVM_METHODS.REQUEST_ACCOUNTS });
    },
    getAccounts() {
      return request<string[]>({ method: EVM_METHODS.GET_ACCOUNTS });
    },
    getChainId() {
      return request<string>({ method: EVM_METHODS.GET_CHAIN_ID });
    },
    switchChain(chainId: string) {
      return request({ method: EVM_METHODS.SWITCH_CHAIN, params: [{ chainId }] });
    },
    addChain(params: Record<string, unknown>) {
      return request({ method: EVM_METHODS.ADD_CHAIN, params: [params] });
    },
    on<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void) {
      requireProvider().on?.(event, handler);
    },
    off<TEvent extends keyof EVMProviderEventMap>(event: TEvent, handler: (payload: EVMProviderEventMap[TEvent]) => void) {
      const current = requireProvider();
      if (current.off) current.off(event, handler);
      else current.removeListener?.(event, handler);
    },
  };
}
