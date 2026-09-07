/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */

export const VEXANIUM_MAINNET = Object.freeze({
  name: "Vexanium Mainnet",
  chainId: "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
  endpoints: Object.freeze(["https://api.windcrypto.com"]),
  contracts: Object.freeze({
    system: "vexcore",
    token: "vex.token",
  }),
  nativeToken: Object.freeze({
    symbol: "VEX",
    precision: 4,
    contract: "vex.token",
  }),
});
