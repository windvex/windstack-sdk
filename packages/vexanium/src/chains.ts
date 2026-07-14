import { VEXANIUM_MAINNET_CHAIN_ID, VEXANIUM_MAINNET_SCOPE } from "./constants.js";
import type { VexaniumCaip2ChainId, VexaniumFullChainId } from "./types.js";

export type WindstackChainEnvironment = "mainnet" | "testnet" | "local";
export type WindstackChainFamily = "antelope" | "evm";

export type WindstackExplorerRoutes = {
  home: string;
  tx: (id: string) => string;
  block: (idOrHeight: string | number) => string;
  account: (account: string) => string;
  token: (contract: string, symbol?: string) => string;
  producer: (producer: string) => string;
  action: (globalSequence: string | number) => string;
};

export type WindstackNativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type VexaniumNativeChainConfig = {
  id: "vexNative";
  family: "antelope";
  name: "Vexanium";
  displayName: "Vexanium Mainnet";
  shortName: "VEX Native";
  environment: WindstackChainEnvironment;
  chainId: VexaniumFullChainId;
  caip2: VexaniumCaip2ChainId;
  scope: VexaniumCaip2ChainId;
  rpcUrl: string;
  apiUrl: string;
  socketUrl: string;
  socketPath: string;
  explorerUrl: string;
  nativeCurrency: WindstackNativeCurrency;
  contracts: {
    system: "vexcore";
    token: "vex.token";
    stake: "vex.stake";
  };
  token: {
    contract: "vex.token";
    symbol: "VEX";
    precision: 4;
  };
  routes: WindstackExplorerRoutes;
};

export type VexaniumEvmChainConfig = {
  id: "vexEvm";
  family: "evm";
  name: "VEX EVM";
  displayName: "Vexanium EVM";
  shortName: "VEX EVM";
  environment: WindstackChainEnvironment;
  chainId: 6736;
  chainIdHex: "0x1a50";
  rpcUrl: string;
  apiUrl: string;
  statsUrl: string;
  explorerUrl: string;
  nativeCurrency: WindstackNativeCurrency;
  routes: Pick<WindstackExplorerRoutes, "home" | "tx" | "block" | "account" | "token">;
};

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const encodePath = (value: string | number): string => encodeURIComponent(String(value));

export function createVexaniumExplorerRoutes(baseUrl: string): WindstackExplorerRoutes {
  const base = trimTrailingSlash(baseUrl);
  return {
    home: base,
    tx: (id) => `${base}/tx/${encodePath(id)}`,
    block: (idOrHeight) => `${base}/block/${encodePath(idOrHeight)}`,
    account: (account) => `${base}/account/${encodePath(account)}`,
    token: (contract, symbol) =>
      symbol ? `${base}/token/${encodePath(contract)}-${encodePath(symbol)}` : `${base}/token/${encodePath(contract)}`,
    producer: (producer) => `${base}/producer/${encodePath(producer)}`,
    action: (globalSequence) => `${base}/action/${encodePath(globalSequence)}`,
  };
}

export function createVexaniumEvmExplorerRoutes(baseUrl: string): VexaniumEvmChainConfig["routes"] {
  const base = trimTrailingSlash(baseUrl);
  return {
    home: base,
    tx: (id) => `${base}/tx/${encodePath(id)}`,
    block: (idOrHeight) => `${base}/block/${encodePath(idOrHeight)}`,
    account: (account) => `${base}/address/${encodePath(account)}`,
    token: (contract) => `${base}/token/${encodePath(contract)}`,
  };
}

export const vexNative = {
  id: "vexNative",
  family: "antelope",
  name: "Vexanium",
  displayName: "Vexanium Mainnet",
  shortName: "VEX Native",
  environment: "mainnet",
  chainId: VEXANIUM_MAINNET_CHAIN_ID,
  caip2: VEXANIUM_MAINNET_SCOPE,
  scope: VEXANIUM_MAINNET_SCOPE,
  rpcUrl: "https://api.windcrypto.com",
  apiUrl: "https://api.windcrypto.com",
  socketUrl: "https://api.windcrypto.com",
  socketPath: "/socket.io/",
  explorerUrl: "https://explorer.windcrypto.com",
  nativeCurrency: {
    name: "Vexanium",
    symbol: "VEX",
    decimals: 4,
  },
  contracts: {
    system: "vexcore",
    token: "vex.token",
    stake: "vex.stake",
  },
  token: {
    contract: "vex.token",
    symbol: "VEX",
    precision: 4,
  },
  routes: createVexaniumExplorerRoutes("https://explorer.windcrypto.com"),
} as const satisfies VexaniumNativeChainConfig;

export const vexEvm = {
  id: "vexEvm",
  family: "evm",
  name: "VEX EVM",
  displayName: "Vexanium EVM",
  shortName: "VEX EVM",
  environment: "mainnet",
  chainId: 6736,
  chainIdHex: "0x1a50",
  rpcUrl: "https://api.windcrypto.com/rpc",
  apiUrl: "https://api.windcrypto.com/v3/evm",
  statsUrl: "https://api.windcrypto.com/v3/evm/stats",
  explorerUrl: "https://explorer.windcrypto.com/evm",
  nativeCurrency: {
    name: "Vexanium",
    symbol: "VEX",
    decimals: 18,
  },
  routes: createVexaniumEvmExplorerRoutes("https://explorer.windcrypto.com/evm"),
} as const satisfies VexaniumEvmChainConfig;

export const vexaniumChains = {
  vexNative,
  vexEvm,
} as const;

export type VexaniumChainKey = keyof typeof vexaniumChains;

export function getVexaniumChain(key: VexaniumChainKey): (typeof vexaniumChains)[VexaniumChainKey] {
  return vexaniumChains[key];
}
