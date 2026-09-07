# WindCrypto WharfKit Migration Inventory

## Overview

The inventory below records active source trees discovered under `/root/windcrypto`. Backups, recovery extracts, generated output, lockfiles, logs, and documentation-only references are excluded from migration decisions.

| Repository | Representative files | Current API | WindStack replacement | Risk | Status |
| --- | --- | --- | --- | --- | --- |
| `windstack-sdk` | `packages/vexanium/src/{accounts,asset,client,validation}.ts` | Antelope names, assets, signatures and checksums | `@windstack/abi`, `@windstack/crypto` and local value helpers | Low | Migrated and tested |
| `windstack-sdk` | `packages/wallet-plugin-wisp/src/WispWalletPlugin.ts` | WharfKit SessionKit plugin | `@windstack/session` `WalletPlugin` and `Signer` | Medium | Migrated and tested |
| `windstack-sdk` | `packages/vexanium/src/signing-request.ts` | SigningRequest encode, parse and compression | Existing compatibility adapter | High | Retained; native protocol replacement is not yet justified |
| `wisp-wallet` | `src/modules/dapp/services/{antelopeDappService,antelopeSigningRequestShared,serializedVexTransactionDecoder}.ts`, `apps/extension/src/background/signing/*` | SigningRequest, identity proof, ABI cache, transaction decode/sign | Native ABI/crypto/RPC plus a future complete signing-request module | High | Pending signing-request and identity-proof parity |
| `wisp-wallet-telegram` | `src/modules/dapp/services/{antelopeDappService,antelopeSigningRequestShared,serializedVexTransactionDecoder}.ts` | SigningRequest, identity proof, ABI cache, transaction decode/sign | Native ABI/crypto/RPC plus a future complete signing-request module | High | Pending signing-request and identity-proof parity |
| `explorer-wind` | `src/features/wallet/context/WindWalletContext.tsx`, `src/features/msig/proposalModel.ts`, `src/lib/{publicKey,windAbiProvider,windVsr}.ts` | SessionKit, packed transactions, ABI and VSR | `@windstack/session`, `@windstack/contract`, `@windstack/crypto`; VSR remains at compatibility boundary | High | Pending controlled application migration |
| `wind-swap-v2` | `src/lib/{actions,signing}.ts`, `src/features/wallet/WindWalletProvider.tsx` | APIClient, ABI cache and action types | `@windstack/rpc`, `@windstack/contract`, `@windstack/session` | Medium | Pending repository test baseline |
| `wisp-tip-bot/server` | `src/antelope/{rpc,signer,tip-contract.gateway,tip-contract.reader}.ts`, `src/app/create-app.ts` | API client, ContractKit, serializer and transaction signing | `@windstack/rpc`, `@windstack/contract`, `@windstack/crypto`, `@windstack/antelope` | Medium | Pending contract-specific migration and tests |
| `wind-realms` | `server/src/{auth/auth.service,game/vex-chain.client}.ts`, `src/auth/AuthProvider.tsx` | Key verification, API client, serialization and transactions | `@windstack/crypto`, `@windstack/abi`, `@windstack/rpc`, `@windstack/antelope` | Medium | Pending coordinated client/server migration |
| `wisp-backend` | `src/services/{rewards,partnerCampaignRewardsAdapter,vexAccountCreation}.service.js` | Keys, signatures, checksums and account transactions | `@windstack/crypto`, `@windstack/account`, `@windstack/antelope` | Medium | Pending transaction API adaptation |
| `wind-wallet-web-vue` | `src/js/{nodes,wallet,chain-state}.js`, transaction and REX pages | APIClient, ContractKit, AccountKit-style resources, values and VSR | Native seven-package stack; VSR stays at compatibility boundary | High | Pending staged wallet migration |
| `wallet/wind-wallet-web-vue` | Same wallet modules and pages in the maintained fork | APIClient, ContractKit, value types and VSR | Native seven-package stack; VSR stays at compatibility boundary | High | Pending fork ownership decision |
| `wallet/wind-wallet-react-heroui-tanstack-fork-v3-flow-aligned` | `src/features/{chain,transactions,wallet}` | ABI cache, API client, keys, values and transactions | Native seven-package stack | Medium | Pending application completion and tests |
| `wisp-dapp-examples` | `react-vite/src/lib/wispNative.ts`, `vue-vite/src/lib/wispNative.ts` | APIClient and ABI cache | `@windstack/rpc` and `@windstack/contract` | Low | Pending release-consumer installation test |
| `evm-miner-vexanium-src` and `contracts/vex-evm-wind/miner` | `src/miner.ts` | Session, private-key wallet and resource helpers | `PrivateKeySigner`, `AntelopeClient`; specialized PowerUp/resource logic stays application-side | High | Pending operational transaction fixtures |

Direct replacement is intentionally deferred where an application depends on SigningRequest resolution, identity proofs, packed-transaction models, REX/resource abstractions, or application-specific transaction composition that the 1.0 public API does not claim to emulate. Those migrations require repository-local tests and must not be performed as a global import rewrite.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
