# WindStack Provider Specifications

## Overview

This directory contains machine-readable provider contracts shared by WindStack SDK packages and Wisp Wallet. The files define stable identifiers and protocol values that must remain consistent across provider implementations and client libraries.

## Provider contract

`wisp-provider-contract.json` defines:

- Wisp provider identity and reverse-DNS identifier
- Vexanium provider version and chain identifiers
- Vexanium capabilities, methods, and discovery events
- Shared provider error codes
- VEX EVM chain identifiers
- EIP-1193 method names
- EIP-6963 discovery events

Wallet-private transport identifiers and runtime-only implementation details are not part of the shared contract.

## Usage

WindStack packages consume the specification through exported constants in `@windstack/core`. Wisp Wallet uses the same values for provider discovery and request handling so dApps receive a consistent provider contract across supported runtimes.

Changes to the machine-readable contract must remain compatible with the public `VexaniumProvider` specification and the exported SDK constants.

## Related specification

`VEXANIUM-PROVIDER-V1.md` documents the browser-facing Vexanium provider interface, capability negotiation, account access, signing requests, events, errors, discovery, and permission security boundary.

## License

MIT License.

Created by **Gilang Ramadan**. Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI.
