export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue | undefined };

export type RequestArguments<TParams = unknown> = {
  method: string;
  params?: TParams;
};

export type DappMetadata = {
  /** Human-readable dApp name shown in wallet approval UI. */
  name: string;
  /** Current dApp URL or canonical app URL. */
  url: string;
  /** Security boundary used for permissions. This must not change silently inside a session. */
  origin: string;
  /** Preferred app icon/logo URL or data URI. */
  icon?: string;
  /** Ordered icon candidates. */
  icons?: string[];
  /** Short human-readable app description. */
  description?: string;
};

export type DappMetadataInput = Partial<DappMetadata> & {
  name?: string;
};

export type ProviderInfo = {
  uuid?: string;
  name: string;
  icon?: string;
  rdns: string;
};

export type ProviderDetail<TProvider, TInfo extends ProviderInfo = ProviderInfo> = {
  info: TInfo;
  provider: TProvider;
};

export type DappRequestMetadataParams = {
  /** Required on connect/login, optional refresh snapshot on later signing requests. */
  dapp?: DappMetadata;
  /** Session identifier returned by the wallet after connect/login. */
  sessionId?: string;
};

export type WispScope =
  | `eip155:${number}`
  | `antelope:${string}`
  | "solana:mainnet"
  | "solana:devnet"
  | `solana:${string}`;

export type WispSessionAccount = {
  scope: WispScope;
  address: string;
  label?: string;
};

export type WispSession = {
  id: string;
  dapp: DappMetadata;
  origin: string;
  scopes: WispScope[];
  accounts: WispSessionAccount[];
  createdAt: number;
  updatedAt: number;
};

export type WispClientOptions = {
  dapp?: DappMetadataInput;
};

export type WispProviderLike<TEvents extends Record<string, unknown> = Record<string, unknown>> = {
  request<TResult = unknown, TParams = unknown>(args: RequestArguments<TParams>): Promise<TResult>;
  on?<TEvent extends keyof TEvents>(event: TEvent, handler: (payload: TEvents[TEvent]) => void): void;
  off?<TEvent extends keyof TEvents>(event: TEvent, handler: (payload: TEvents[TEvent]) => void): void;
  removeListener?<TEvent extends keyof TEvents>(event: TEvent, handler: (payload: TEvents[TEvent]) => void): void;
};
