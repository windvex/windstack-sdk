export const WISP_PROVIDER_CONTRACT = {
  schemaVersion: 1,
  provider: {
    name: "Wisp",
    rdns: "com.wisp.wallet",
  },
  vex: {
    global: "vexanium",
    standard: "VexaniumProvider",
    version: "1.0.0",
    chainId:
      "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
    scope: "antelope:f9f432b1851b5c179d2091a96f593aae",
    capabilities: [
      "vex.accounts",
      "vex.sessions",
      "vex.signTransaction",
      "vex.signingRequest",
      "vex.signMessage",
      "vex.signDigest",
      "vex.events",
    ],
    methods: {
      getCapabilities: "vex_getCapabilities",
      requestAccounts: "vex_requestAccounts",
      getAccounts: "vex_getAccounts",
      getChain: "vex_getChain",
      signingRequest: "vex_signingRequest",
      signMessage: "vex_signMessage",
      signDigest: "vex_signDigest",
      signTransaction: "vex_signTransaction",
      disconnect: "vex_disconnect",
    },
    events: {
      requestProvider: "vexanium:requestProvider",
      announceProvider: "vexanium:announceProvider",
    },
  },
  evm: {
    global: "ethereum",
    chainId: 6736,
    chainIdHex: "0x1a50",
    methods: {
      requestAccounts: "eth_requestAccounts",
      getAccounts: "eth_accounts",
      getChainId: "eth_chainId",
      switchChain: "wallet_switchEthereumChain",
      addChain: "wallet_addEthereumChain",
    },
    events: {
      requestProvider: "eip6963:requestProvider",
      announceProvider: "eip6963:announceProvider",
    },
  },
} as const;

export type WispProviderContract = typeof WISP_PROVIDER_CONTRACT;
