# @windstack/wallet-plugin-wisp

WharfKit SessionKit wallet plugin for Wisp on Vexanium Mainnet.

```bash
npm install @windstack/wallet-plugin-wisp @windstack/vexanium \
  @wharfkit/session @wharfkit/antelope @wharfkit/signing-request
```

```ts
import { SessionKit } from "@wharfkit/session";
import { WispWalletPlugin } from "@windstack/wallet-plugin-wisp";
import { vexNative } from "@windstack/vexanium";

const sessionKit = new SessionKit({
  appName: "My Vexanium App",
  chains: [{ id: vexNative.chainId, url: vexNative.rpcUrl }],
  walletPlugins: [new WispWalletPlugin()],
});

const { session } = await sessionKit.login();

await session.transact({
  action: {
    account: "vex.token",
    name: "transfer",
    authorization: [session.permissionLevel],
    data: {
      from: session.actor,
      to: "receiver",
      quantity: "1.0000 VEX",
      memo: "",
    },
  },
});
```

SessionKit resolves placeholders, ABI data, signer, TAPOS, and transaction bytes. The plugin sends `ResolvedSigningRequest.serializedTransaction` to Wisp through `vex_signTransaction` and converts the returned strings to WharfKit `Signature` values.

The plugin supports Vexanium Mainnet only. It rejects a different chain during both login and signing. Unless a provider or client is supplied explicitly, it selects the provider whose reverse-DNS identifier is `com.wisp.wallet`.

Portable `vsr:` requests are handled by `@windstack/vexanium`; they are separate from the connected SessionKit transaction path.

## License

MIT, PT WIND KRIPTOGRAFI TEKNOLOGI.
