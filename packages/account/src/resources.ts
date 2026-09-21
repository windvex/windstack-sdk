/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */

export type AccountResourceLimit = Readonly<{
  used: number;
  available: number;
  max: number;
}>;

export type AccountResources = Readonly<{
  ram: Readonly<{
    quotaBytes: number;
    usedBytes: number;
    availableBytes: number;
  }>;
  cpu: AccountResourceLimit;
  net: AccountResourceLimit;
}>;

export type AccountResourceEstimate = Readonly<{
  cpuUs: number;
  netBytes: number;
  ramBytes: number;
}>;

export type AccountResourceCheck = Readonly<{
  sufficient: boolean;
  cpu: Readonly<{ requiredUs: number; availableUs: number; sufficient: boolean }>;
  net: Readonly<{ requiredBytes: number; availableBytes: number; sufficient: boolean }>;
  ram: Readonly<{ requiredBytes: number; availableBytes: number; sufficient: boolean }>;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function nonNegativeInteger(value: unknown, label: string): number {
  const normalized = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(normalized) || (normalized as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return normalized as number;
}

function resourceLimit(value: unknown, label: string): AccountResourceLimit {
  const limit = object(value, label);
  return Object.freeze({
    used: nonNegativeInteger(limit.used, `${label}.used`),
    available: nonNegativeInteger(limit.available, `${label}.available`),
    max: nonNegativeInteger(limit.max, `${label}.max`),
  });
}

export function normalizeAccountResources(value: unknown): AccountResources {
  const account = object(value, "account");
  const quotaBytes = nonNegativeInteger(account.ram_quota, "ram_quota");
  const usedBytes = nonNegativeInteger(account.ram_usage, "ram_usage");
  return Object.freeze({
    ram: Object.freeze({
      quotaBytes,
      usedBytes,
      availableBytes: Math.max(0, quotaBytes - usedBytes),
    }),
    cpu: resourceLimit(account.cpu_limit, "cpu_limit"),
    net: resourceLimit(account.net_limit, "net_limit"),
  });
}

export function checkAccountResources(
  resources: AccountResources,
  estimate: AccountResourceEstimate,
): AccountResourceCheck {
  const cpuUs = nonNegativeInteger(estimate.cpuUs, "estimate.cpuUs");
  const netBytes = nonNegativeInteger(estimate.netBytes, "estimate.netBytes");
  const ramBytes = nonNegativeInteger(estimate.ramBytes, "estimate.ramBytes");
  const cpuSufficient = cpuUs <= resources.cpu.available;
  const netSufficient = netBytes <= resources.net.available;
  const ramSufficient = ramBytes <= resources.ram.availableBytes;

  return Object.freeze({
    sufficient: cpuSufficient && netSufficient && ramSufficient,
    cpu: Object.freeze({
      requiredUs: cpuUs,
      availableUs: resources.cpu.available,
      sufficient: cpuSufficient,
    }),
    net: Object.freeze({
      requiredBytes: netBytes,
      availableBytes: resources.net.available,
      sufficient: netSufficient,
    }),
    ram: Object.freeze({
      requiredBytes: ramBytes,
      availableBytes: resources.ram.availableBytes,
      sufficient: ramSufficient,
    }),
  });
}
