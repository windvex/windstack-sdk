/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const releaseRoot = path.join(root, ".release");
export const currentCandidatePointer = path.join(releaseRoot, "current.json");

export const packageDirectories = [
  "core",
  "crypto",
  "abi",
  "rpc",
  "contract",
  "account",
  "antelope",
  "signing-request",
  "session",
  "evm",
  "solana",
  "vexanium",
  "wallet-plugin-wisp",
];

export function git(args, options = {}) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch (error) {
    if (options.allowFailure) return "";
    throw error;
  }
}

export function tarballFilename(name, version) {
  return `${name.replace(/^@/u, "").replace("/", "-")}-${version}.tgz`;
}

export async function loadReleaseEntries() {
  const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const entries = [];
  for (const directory of packageDirectories) {
    const manifest = JSON.parse(
      await readFile(path.join(root, "packages", directory, "package.json"), "utf8"),
    );
    if (manifest.name !== `@windstack/${directory}`) {
      throw new Error(`Unexpected package name in packages/${directory}`);
    }
    if (manifest.version !== rootManifest.version) {
      throw new Error(`${manifest.name} does not match root version ${rootManifest.version}`);
    }
    entries.push({ directory, manifest });
  }
  return { rootManifest, entries };
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

export async function loadCurrentCandidate() {
  await access(currentCandidatePointer);
  const pointer = JSON.parse(await readFile(currentCandidatePointer, "utf8"));
  if (
    pointer.schemaVersion !== 1 ||
    typeof pointer.manifest !== "string" ||
    !pointer.manifest.startsWith("candidates/")
  ) {
    throw new Error("Invalid WindStack release candidate pointer");
  }
  const manifestPath = path.join(releaseRoot, pointer.manifest);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  return {
    pointer,
    manifest,
    manifestPath,
    directory: path.dirname(manifestPath),
  };
}

export async function verifyCurrentCandidate({ requireHead = true } = {}) {
  const candidate = await loadCurrentCandidate();
  const { rootManifest, entries } = await loadReleaseEntries();
  const head = git(["rev-parse", "HEAD"]);

  if (candidate.manifest.schemaVersion !== 1) {
    throw new Error("Unsupported release candidate manifest version");
  }
  if (candidate.manifest.version !== rootManifest.version) {
    throw new Error(
      `Candidate version ${candidate.manifest.version} does not match workspace ${rootManifest.version}`,
    );
  }
  if (requireHead && candidate.manifest.gitSha !== head) {
    throw new Error(
      `Candidate Git SHA ${candidate.manifest.gitSha} does not match current HEAD ${head}`,
    );
  }
  if (!Array.isArray(candidate.manifest.packages)) {
    throw new Error("Release candidate manifest has no package list");
  }

  const expectedNames = entries.map(({ manifest }) => manifest.name).sort();
  const actualNames = candidate.manifest.packages.map(({ name }) => name).sort();
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    throw new Error("Release candidate package set does not match the workspace");
  }

  const verifiedPackages = [];
  for (const entry of candidate.manifest.packages) {
    if (
      typeof entry.name !== "string" ||
      typeof entry.version !== "string" ||
      typeof entry.filename !== "string" ||
      typeof entry.sha256 !== "string"
    ) {
      throw new Error("Release candidate package metadata is malformed");
    }
    if (entry.version !== rootManifest.version) {
      throw new Error(`${entry.name} candidate version is ${entry.version}`);
    }

    const filePath = path.join(candidate.directory, entry.filename);
    await access(filePath);
    const sha256 = await sha256File(filePath);
    if (sha256 !== entry.sha256) {
      throw new Error(`${entry.filename} SHA256 mismatch`);
    }
    verifiedPackages.push({ ...entry, filePath });
  }

  return {
    ...candidate,
    head,
    rootManifest,
    entries,
    packages: verifiedPackages,
  };
}

export function dependencyNames(manifest) {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
}

export function sortForPublish(entries) {
  const byName = new Map(entries.map((entry) => [entry.manifest.name, entry]));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(entry) {
    const name = entry.manifest.name;
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error(`Circular release dependency detected at ${name}`);
    visiting.add(name);

    const internal = [...dependencyNames(entry.manifest)]
      .filter((dependency) => byName.has(dependency))
      .sort();
    for (const dependency of internal) visit(byName.get(dependency));

    visiting.delete(name);
    visited.add(name);
    ordered.push(entry);
  }

  for (const entry of [...entries].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))) {
    visit(entry);
  }
  return ordered;
}
