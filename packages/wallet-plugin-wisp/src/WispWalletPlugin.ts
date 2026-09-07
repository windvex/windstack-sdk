/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { bytesToHex, type SignRequest, type Signer } from "@windstack/antelope";
import type { DappMetadataInput } from "@windstack/core";
import type { WalletLoginContext, WalletLoginResult, WalletPlugin } from "@windstack/session";
import {
  VEXANIUM_ERROR_CODES,
  VEXANIUM_MAINNET_CHAIN_ID,
  VexaniumProviderError,
  createVexaniumClient,
  type VexaniumAccount,
  type VexaniumClient,
  type VexaniumProvider,
} from "@windstack/vexanium";

const WISP_PROVIDER_RDNS = "com.wisp.wallet";

export type WispWalletPluginMetadata = {
  name?: string;
  description?: string;
  icon?: string;
  homepage?: string;
};

export type WispWalletPluginOptions = {
  provider?: VexaniumProvider;
  client?: VexaniumClient;
  metadata?: WispWalletPluginMetadata;
  dapp?: DappMetadataInput;
};

class WispSigner implements Signer {
  constructor(
    private readonly client: VexaniumClient,
    private readonly account: VexaniumAccount,
  ) {}

  async getAvailableKeys(): Promise<readonly string[]> {
    if (!this.account.publicKey) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_REQUEST,
        "Wisp account identity must include a public key for required-key discovery",
      );
    }
    return [this.account.publicKey];
  }

  async sign(request: SignRequest): Promise<readonly string[]> {
    if (request.chainId !== VEXANIUM_MAINNET_CHAIN_ID) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_PARAMS,
        `WispWalletPlugin cannot sign for unsupported chain: ${request.chainId}`,
      );
    }
    const result = await this.client.signTransaction({
      serializedTransaction: bytesToHex(request.serializedTransaction),
      chainId: request.chainId,
      account: this.account.actor,
      permission: this.account.permission,
    });
    return result.signatures;
  }
}

/** Native WindStack session plugin for Wisp on Vexanium Mainnet. */
export class WispWalletPlugin implements WalletPlugin {
  readonly id = "wisp";
  readonly metadata: Readonly<
    Required<Pick<WispWalletPluginMetadata, "name" | "description">> & WispWalletPluginMetadata
  >;

  private readonly suppliedClient?: VexaniumClient;
  private readonly suppliedProvider?: VexaniumProvider;
  private readonly dapp?: DappMetadataInput;
  private clientPromise?: Promise<VexaniumClient>;

  constructor(options: WispWalletPluginOptions = {}) {
    this.suppliedClient = options.client;
    this.suppliedProvider = options.provider;
    this.dapp = options.dapp;
    this.metadata = Object.freeze({
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
      this.clientPromise = undefined;
      throw error;
    });
    return this.clientPromise;
  }

  private assertChain(context: WalletLoginContext): void {
    if (context.chain.id !== VEXANIUM_MAINNET_CHAIN_ID) {
      throw new VexaniumProviderError(
        VEXANIUM_ERROR_CODES.INVALID_PARAMS,
        `WispWalletPlugin supports Vexanium Mainnet only: ${VEXANIUM_MAINNET_CHAIN_ID}`,
        { requestedChainId: context.chain.id },
      );
    }
  }

  private loginResult(client: VexaniumClient, account: VexaniumAccount): WalletLoginResult {
    return {
      identity: {
        actor: account.actor,
        permission: account.permission,
        publicKey: account.publicKey,
      },
      signer: new WispSigner(client, account),
    };
  }

  async login(context: WalletLoginContext): Promise<WalletLoginResult> {
    this.assertChain(context);
    const client = await this.getClient();
    const account = await client.connectOne({ chainId: context.chain.id });
    return this.loginResult(client, account);
  }

  async restore(
    context: WalletLoginContext & {
      identity: { actor: string; permission: string; publicKey?: string };
    },
  ): Promise<WalletLoginResult | null> {
    this.assertChain(context);
    const client = await this.getClient();
    const session = client.getSession();
    if (!session) return null;
    const account = session.accounts.find(
      (item) =>
        item.actor === context.identity.actor && item.permission === context.identity.permission,
    );
    if (!account) return null;
    return this.loginResult(client, {
      ...account,
      publicKey: account.publicKey ?? context.identity.publicKey,
    });
  }

  async logout(): Promise<void> {
    await (await this.getClient()).disconnect();
  }
}
