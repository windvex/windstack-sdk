import { invalidParams } from "@windstack/core";
import type { VexaniumAccount, VexaniumChainId, VexaniumPermissionLevel } from "./types.js";

export function parsePermissionLevel(value: string): VexaniumPermissionLevel & { permissionLevel: `${string}@${string}` } {
  const [actorRaw, permissionRaw] = value.split("@");
  const actor = actorRaw?.trim();
  const permission = permissionRaw?.trim() || "active";
  if (!actor) throw invalidParams("Invalid Vexanium permission level");
  return { actor, permission, permissionLevel: `${actor}@${permission}` };
}

export function normalizeVexaniumAccount(value: unknown, fallbackChainId: VexaniumChainId): VexaniumAccount {
  if (typeof value === "string") {
    return { chainId: fallbackChainId, ...parsePermissionLevel(value) };
  }

  if (typeof value === "object" && value !== null) {
    const source = value as Partial<VexaniumAccount> & { account?: string; name?: string };
    const permissionLevel = source.permissionLevel ?? source.account ?? (
      source.actor && source.permission ? `${source.actor}@${source.permission}` : source.name
    );
    const parsed = parsePermissionLevel(permissionLevel ?? "");
    const actor = source.actor ?? parsed.actor;
    const permission = source.permission ?? parsed.permission;
    return {
      chainId: source.chainId ?? fallbackChainId,
      actor,
      permission,
      permissionLevel: `${actor}@${permission}`,
      publicKey: source.publicKey,
      label: source.label,
    };
  }

  throw invalidParams("Invalid Vexanium account payload", value);
}

export function normalizeVexaniumAccounts(value: unknown, fallbackChainId: VexaniumChainId): VexaniumAccount[] {
  if (!Array.isArray(value)) return [];
  return value.map((account) => normalizeVexaniumAccount(account, fallbackChainId));
}
