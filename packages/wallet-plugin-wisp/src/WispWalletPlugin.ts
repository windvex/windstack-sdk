import { Bytes, PermissionLevel, Signature } from "@wharfkit/antelope";
import { AbstractWalletPlugin, WalletPluginMetadata } from "@wharfkit/session";
import type {
  LoginContext,
  TransactContext,
  WalletPluginConfig,
  WalletPluginLoginResponse,
  WalletPluginSignResponse,
} from "@wharfkit/session";
import type { ResolvedSigningRequest } from "@wharfkit/signing-request";
import {
  VEXANIUM_MAINNET_CHAIN_ID,
  VEXANIUM_ERROR_CODES,
  WISP_PROVIDER_RDNS,
  createVexaniumClient,
  type VexaniumClient,
  type VexaniumProvider,
  VexaniumProviderError,
  type VexSignTransactionResult,
} from "@windstack/vexanium";
import type { DappMetadataInput } from "@windstack/core";

export type WispWalletPluginOptions = {
  provider?: VexaniumProvider;
  client?: VexaniumClient;
  metadata?: ConstructorParameters<typeof WalletPluginMetadata>[0];
  dapp?: DappMetadataInput;
};

/**
 * WharfKit WalletPlugin for Wisp on Vexanium Mainnet.
 *
 * SessionKit owns the dApp session lifecycle. This plugin only adapts
 * SessionKit login/sign requests to the Wisp Vexanium provider.
 */
export class WispWalletPlugin extends AbstractWalletPlugin {
  readonly id = "wisp";
  readonly config: WalletPluginConfig = {
    requiresChainSelect: false,
    requiresPermissionSelect: false,
    requiresPermissionEntry: false,
    supportedChains: [VEXANIUM_MAINNET_CHAIN_ID],
  };
  readonly metadata: WalletPluginMetadata;

  private readonly suppliedClient?: VexaniumClient;
  private readonly suppliedProvider?: VexaniumProvider;
  private readonly dapp?: DappMetadataInput;
  private clientPromise?: Promise<VexaniumClient>;

  constructor(options: WispWalletPluginOptions = {}) {
    super();
    this.suppliedClient = options.client;
    this.suppliedProvider = options.provider;
    this.dapp = options.dapp;
    this.metadata = new WalletPluginMetadata({
      name: "Wisp",
      description: "Connect and sign Vexanium transactions with Wisp.",
      ...options.metadata,
    });
  }

  private getClient(): Promise<VexaniumClient> {
    if (this.suppliedClient) return Promise.resolve(this.suppliedClient);

    this.clientPromise ??= createVexaniumClient({
      provider: this.suppliedProvider,
      providerRdns: this.suppliedProvider ? undefined : WISP_PROVIDER_RDNS,
      dapp: this.dapp,
    }).catch((error) => {
      // A transient discovery failure must not permanently poison future login attempts.
      this.clientPromise = undefined;
      throw error;
    });

    return this.clientPromise;
  }

  async login(context: LoginContext): Promise<WalletPluginLoginResponse> {
    if (!context.chain) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_PARAMS,
        "A SessionKit chain is required for Wisp login",
      );
    }

    const chainId = context.chain.id.toString();
    if (chainId !== VEXANIUM_MAINNET_CHAIN_ID) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_PARAMS,
        `WispWalletPlugin supports Vexanium Mainnet only: ${VEXANIUM_MAINNET_CHAIN_ID}`,
        { requestedChainId: chainId },
      );
    }

    const client = await this.getClient();
    const account = await client.connectOne({ chainId });

    return {
      chain: context.chain.id,
      permissionLevel: PermissionLevel.from(account.permissionLevel),
    };
  }

  async sign(
    resolved: ResolvedSigningRequest,
    _context: TransactContext,
  ): Promise<WalletPluginSignResponse> {
    const chainId = resolved.chainId.toString();
    if (chainId !== VEXANIUM_MAINNET_CHAIN_ID) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_PARAMS,
        `WispWalletPlugin cannot sign for unsupported chain: ${chainId}`,
      );
    }

    // SessionKit has already resolved placeholders, ABI data, TAPOS, signer, and chain.
    // Sign these exact serialized bytes directly; do not re-wrap the transaction as ESR/VSR.
    const result = await (await this.getClient()).signTransaction({
      serializedTransaction: Bytes.from(resolved.serializedTransaction).hexString,
      chainId,
      account: resolved.signer.actor.toString(),
      permission: resolved.signer.permission.toString(),
    });

    return {
      resolved,
      signatures: parseSignatures(result),
    };
  }
}

function parseSignatures(result: Pick<VexSignTransactionResult, "signatures">): Signature[] {
  if (!Array.isArray(result.signatures) || result.signatures.length === 0) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Wisp returned no transaction signatures",
    );
  }
  try {
    return result.signatures.map((signature) => Signature.from(signature));
  } catch (error) {
    throw new VexaniumProviderError(
      VEXANIUM_ERROR_CODES.INVALID_REQUEST,
      "Wisp returned an invalid Antelope signature",
      error,
    );
  }
}
