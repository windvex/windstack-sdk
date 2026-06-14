import { Checksum256, PermissionLevel, Signature } from "@wharfkit/antelope";
import { AbstractWalletPlugin, WalletPluginMetadata } from "@wharfkit/session";
import type {
  LoginContext,
  SerializedWalletPlugin,
  TransactContext,
  WalletPluginConfig,
  WalletPluginLoginResponse,
  WalletPluginSignResponse,
} from "@wharfkit/session";
import { ResolvedSigningRequest, SigningRequest } from "@wharfkit/signing-request";
import {
  createVexaniumClient,
  encodeVsr,
  type VexaniumClient,
  type VexaniumProvider,
  type VsrSigningRequestResult,
} from "@windstack/vexanium";
import { WISP_ERROR_CODES, WispProviderError } from "@windstack/core";
import type { DappMetadataInput } from "@windstack/core";

export type WispSessionPluginOptions = {
  provider?: VexaniumProvider;
  client?: VexaniumClient;
  metadata?: ConstructorParameters<typeof WalletPluginMetadata>[0];
  dapp?: DappMetadataInput;
};

export class WispSessionPlugin extends AbstractWalletPlugin {
  readonly id = "wisp";
  readonly config: WalletPluginConfig = {
    requiresChainSelect: false,
    requiresPermissionSelect: false,
    requiresPermissionEntry: false,
  };
  readonly metadata: WalletPluginMetadata;
  private readonly suppliedClient?: VexaniumClient;
  private readonly suppliedProvider?: VexaniumProvider;
  private readonly dapp?: DappMetadataInput;

  constructor(options: WispSessionPluginOptions = {}) {
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

  serialize(): SerializedWalletPlugin {
    return { id: this.id, data: this.data };
  }

  private async getClient(): Promise<VexaniumClient> {
    return this.suppliedClient ?? await createVexaniumClient({ provider: this.suppliedProvider, dapp: this.dapp });
  }

  async login(context: LoginContext): Promise<WalletPluginLoginResponse> {
    if (!context.chain) {
      throw new WispProviderError(WISP_ERROR_CODES.INVALID_PARAMS, "A SessionKit chain is required for Wisp login");
    }

    const client = await this.getClient();
    const account = await client.connectOne({ chainId: context.chain.id.toString() });

    return {
      chain: Checksum256.from(context.chain.id),
      permissionLevel: PermissionLevel.from(account.permissionLevel),
    };
  }

  async sign(resolved: ResolvedSigningRequest, _context: TransactContext): Promise<WalletPluginSignResponse> {
    const request = SigningRequest.fromTransaction(resolved.chainId, resolved.serializedTransaction);
    request.setBroadcast(false);
    const vsr = encodeVsr(request, { compress: false, slashes: true });
    const result = await (await this.getClient()).signVsr({ vsr, broadcast: false });

    return {
      resolved,
      signatures: normalizeSignatures(result),
    };
  }
}

export function normalizeSignatures(result: VsrSigningRequestResult): Signature[] {
  return result.signatures.map((signature) => Signature.from(signature));
}

export function createWispSessionPlugin(options: WispSessionPluginOptions = {}): WispSessionPlugin {
  return new WispSessionPlugin(options);
}
