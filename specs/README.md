# WindStack provider specifications

`wisp-provider-contract.json` is the canonical machine-readable contract shared
by WindStack SDK packages and the Wisp Wallet provider runtime.

It defines only standards-facing values:

- Wisp provider identity (`name` and reverse-DNS identifier)
- VexaniumProvider version, chain identifiers, capabilities, methods, and
  discovery events
- EIP-1193 method names, EIP-6963 discovery events, and VEX EVM chain identifiers

Wallet-specific message transport identifiers are intentionally excluded. Wisp
keeps those private fields in its local runtime contract while synchronizing the
canonical sections from this file.

Run the full WindStack validation before changing the specification:

```bash
npm run validate
```

`test-provider-spec.mjs` fails when the JSON specification and exported SDK
constants no longer match. Wisp Wallet independently checks its synchronized
copy through `scripts/sync-windstack-provider-contract.mjs`.
