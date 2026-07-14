import { WISP_ERROR_CODES, WispProviderError, normalizeProviderError } from "@windstack/core";
import type { RequestArguments } from "@windstack/core";
import { SOLANA_METHODS } from "./constants.js";
import { isSolanaPublicKey, normalizeSolanaAccounts } from "./accounts.js";
import { getInjectedSolanaProvider } from "./discovery.js";
import type {
  SolanaClient,
  SolanaClientOptions,
  SolanaProvider,
  SolanaProviderEventMap,
  SolanaSignMessageParams,
  SolanaTransactionParams,
} from "./types.js";

export async function createSolanaClient(options: SolanaClientOptions = {}): Promise<SolanaClient> {
  let provider: SolanaProvider | null = options.provider ?? getInjectedSolanaProvider();

  const requireProvider = (): SolanaProvider => {
    provider = provider ?? getInjectedSolanaProvider();
    if (!provider?.request) throw new WispProviderError(WISP_ERROR_CODES.INTERNAL_ERROR, "No Solana provider is available");
    return provider;
  };

  const request = async <TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult> => {
    try {
      return await requireProvider().request<TResult, TParams>(args);
    } catch (error) {
      throw normalizeProviderError(error);
    }
  };

  const assertBase64Transaction = (value: string): void => {
    if (value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
      throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, "Transaction must be standard base64");
    }
  };

  return {
    isAvailable() {
      return Boolean(provider?.request || getInjectedSolanaProvider()?.request);
    },
    getProvider() {
      provider = provider ?? getInjectedSolanaProvider();
      return provider;
    },
    request,
    async connect() {
      return normalizeSolanaAccounts(await request({ method: SOLANA_METHODS.REQUEST_ACCOUNTS }));
    },
    async getAccounts() {
      return normalizeSolanaAccounts(await request({ method: SOLANA_METHODS.GET_ACCOUNTS }));
    },
    async signMessage(message: string | Uint8Array, publicKey?: string) {
      if (publicKey && !isSolanaPublicKey(publicKey)) {
        throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, "Invalid Solana public key");
      }
      const params: SolanaSignMessageParams = {
        message: typeof message === "string" ? message : Array.from(message),
        publicKey,
      };
      return await request({ method: SOLANA_METHODS.SIGN_MESSAGE, params });
    },
    async signTransaction(transactionBase64: string) {
      assertBase64Transaction(transactionBase64);
      const params: SolanaTransactionParams = { transaction: transactionBase64 };
      return await request({ method: SOLANA_METHODS.SIGN_TRANSACTION, params });
    },
    async signAndSendTransaction(transactionBase64: string) {
      assertBase64Transaction(transactionBase64);
      const params: SolanaTransactionParams = { transaction: transactionBase64 };
      return await request({ method: SOLANA_METHODS.SIGN_AND_SEND_TRANSACTION, params });
    },
    async disconnect() {
      await request({ method: SOLANA_METHODS.DISCONNECT });
    },
    on<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void) {
      requireProvider().on?.(event, handler);
    },
    off<TEvent extends keyof SolanaProviderEventMap>(event: TEvent, handler: (payload: SolanaProviderEventMap[TEvent]) => void) {
      const current = requireProvider();
      if (current.off) current.off(event, handler);
      else current.removeListener?.(event, handler);
    },
  };
}
