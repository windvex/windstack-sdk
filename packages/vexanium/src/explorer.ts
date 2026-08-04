import { createVexaniumEvmExplorerRoutes, vexEvm, vexNative } from "./chains.js";

export type ExplorerTarget = "native" | "evm";

export type BuildExplorerUrlOptions = {
  target?: ExplorerTarget;
  baseUrl?: string;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const encodePath = (value: string | number): string => encodeURIComponent(String(value));
const nativeBase = (baseUrl?: string): string => trimTrailingSlash(baseUrl ?? vexNative.explorerUrl);
const evmBase = (baseUrl?: string): string => trimTrailingSlash(baseUrl ?? vexEvm.explorerUrl);
const evmRoutes = (baseUrl?: string) => createVexaniumEvmExplorerRoutes(evmBase(baseUrl));

export function buildExplorerTxUrl(txId: string, options: BuildExplorerUrlOptions = {}): string {
  return options.target === "evm"
    ? evmRoutes(options.baseUrl).tx(txId)
    : `${nativeBase(options.baseUrl)}/tx/${encodePath(txId)}`;
}

export function buildExplorerBlockUrl(block: string | number, options: BuildExplorerUrlOptions = {}): string {
  return options.target === "evm"
    ? evmRoutes(options.baseUrl).block(block)
    : `${nativeBase(options.baseUrl)}/block/${encodePath(block)}`;
}

export function buildExplorerAccountUrl(account: string, options: BuildExplorerUrlOptions = {}): string {
  return options.target === "evm"
    ? evmRoutes(options.baseUrl).account(account)
    : `${nativeBase(options.baseUrl)}/account/${encodePath(account)}`;
}

export function buildExplorerTokenUrl(contract: string, symbol?: string, options: BuildExplorerUrlOptions = {}): string {
  if (options.target === "evm") {
    return evmRoutes(options.baseUrl).token(contract);
  }
  return symbol
    ? `${nativeBase(options.baseUrl)}/tokens/${encodePath(contract)}/${encodePath(symbol)}`
    : `${nativeBase(options.baseUrl)}/token/${encodePath(contract)}`;
}

export function buildExplorerProducerUrl(producer: string, options: Omit<BuildExplorerUrlOptions, "target"> = {}): string {
  return `${nativeBase(options.baseUrl)}/producer/${encodePath(producer)}`;
}

export function buildExplorerActionUrl(globalSequence: string | number, options: Omit<BuildExplorerUrlOptions, "target"> = {}): string {
  return `${nativeBase(options.baseUrl)}/action/${encodePath(globalSequence)}`;
}
