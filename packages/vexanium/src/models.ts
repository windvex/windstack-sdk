import type { VexaniumPermissionLevel } from "./types.js";

export type VexaniumActionModel<TData = unknown> = {
  account: string;
  name: string;
  authorization: VexaniumPermissionLevel[];
  data: TData;
  hexData?: string;
};

export type VexaniumTransactionStatus = "executed" | "soft_fail" | "hard_fail" | "delayed" | "expired" | "unknown";

export type VexaniumResourceUsage = {
  cpuUs?: number;
  netBytes?: number;
  ramBytes?: number;
};

export type VexaniumTransactionModel<TActionData = unknown> = {
  id: string;
  status: VexaniumTransactionStatus;
  blockNum?: number;
  blockTime?: string;
  producer?: string;
  actions: VexaniumActionModel<TActionData>[];
  inlineActions?: VexaniumActionModel<TActionData>[];
  resourceUsage?: VexaniumResourceUsage;
  console?: string;
  returnValue?: unknown;
  signatures?: string[];
  raw?: unknown;
};

export type VexaniumTokenMetadata = {
  contract: string;
  symbol: string;
  precision: number;
  name?: string;
  icon?: string;
  verified?: boolean;
  issuer?: string;
  maxSupply?: string;
  supply?: string;
  category?: string;
};

export type VexaniumProducerModel = {
  owner: string;
  producerKey?: string;
  url?: string;
  totalVotes?: string | number;
  unpaidBlocks?: number;
  isActive?: boolean;
};

export type VexaniumResourceModel = {
  account: string;
  cpu: {
    used: number;
    available: number;
    max: number;
  };
  net: {
    used: number;
    available: number;
    max: number;
  };
  ram: {
    used: number;
    quota: number;
  };
};
