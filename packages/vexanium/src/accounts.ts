import { PermissionLevel } from "@wharfkit/antelope";
import type { VexaniumAccount, VexaniumChainId, VexaniumPermissionLevel } from "./types.js";
import { vexaniumInvalidParams } from "./errors.js";
import { isAntelopeName, isVexaniumChainId } from "./validation.js";

export function parsePermissionLevel(value: string): VexaniumPermissionLevel & { permissionLevel: `${string}@${string}` } {
  const candidate = value.includes("@") ? value : `${value}@active`;
  try {
    const parsed = PermissionLevel.from(candidate);
    const actor = parsed.actor.toString();
    const permission = parsed.permission.toString();
    if (!isAntelopeName(actor) || !isAntelopeName(permission) || `${actor}@${permission}` !== candidate) {
      throw new Error("Permission level is not canonically encoded");
    }
    return { actor, permission, permissionLevel: `${actor}@${permission}` };
  } catch {
    throw vexaniumInvalidParams("Invalid Vexanium permission level", value);
  }
}

export function normalizeVexaniumAccount(value: unknown, fallbackChainId: VexaniumChainId): VexaniumAccount {
  if (typeof value === "string") {
    return { chainId: fallbackChainId, ...parsePermissionLevel(value) };
  }

  if (typeof value === "object" && value !== null) {
    const source = value as Partial<VexaniumAccount> & { account?: string; name?: string };
    const aliases = [source.permissionLevel, source.account, source.name]
      .filter((candidate) => candidate !== undefined);
    if (!aliases.every((candidate) => typeof candidate === "string")) {
      throw vexaniumInvalidParams("Invalid Vexanium account permission fields", value);
    }
    const permissionLevel = aliases[0] ?? (
      source.actor ? `${source.actor}@${source.permission ?? "active"}` : undefined
    );
    const parsed = parsePermissionLevel(permissionLevel ?? "");
    const actor = source.actor?.trim() ?? parsed.actor;
    const permission = source.permission?.trim() ?? parsed.permission;
    const chainId = source.chainId ?? fallbackChainId;
    if (!isAntelopeName(actor) || !isAntelopeName(permission) || !isVexaniumChainId(chainId)) {
      throw vexaniumInvalidParams("Invalid Vexanium account payload", value);
    }
    const canonicalPermission: `${string}@${string}` = `${actor}@${permission}`;
    if (aliases.some((alias) => parsePermissionLevel(alias).permissionLevel !== canonicalPermission)) {
      throw vexaniumInvalidParams("Conflicting Vexanium account permission fields", value);
    }
    return {
      chainId,
      actor,
      permission,
      permissionLevel: canonicalPermission,
      publicKey: typeof source.publicKey === "string" ? source.publicKey : undefined,
      label: typeof source.label === "string" ? source.label : undefined,
    };
  }

  throw vexaniumInvalidParams("Invalid Vexanium account payload", value);
}

export function normalizeVexaniumAccounts(value: unknown, fallbackChainId: VexaniumChainId): VexaniumAccount[] {
  if (!Array.isArray(value)) return [];
  return value.map((account) => normalizeVexaniumAccount(account, fallbackChainId));
}
