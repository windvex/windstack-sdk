/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = "https://registry.npmjs.org/";
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`,
    );
  }
  return result;
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function requireReleaseState() {
  const branch = git(["branch", "--show-current"]);
  if (branch !== "main") {
    throw new Error(`Release must run from main; current branch is ${branch || "detached"}`);
  }
  if (git(["status", "--porcelain"])) {
    throw new Error("Release requires a clean working tree");
  }

  run("git", ["fetch", "--quiet", "origin", "main"]);
  const head = git(["rev-parse", "HEAD"]);
  const remoteHead = git(["rev-parse", "origin/main"]);
  if (head !== remoteHead) {
    throw new Error("Release requires local main to match origin/main exactly");
  }
}

async function loadReleaseManifests() {
  const rootManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const entries = (await readdir(path.join(root, "packages"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const manifests = [];
  for (const directory of entries) {
    const manifest = JSON.parse(
      await readFile(path.join(root, "packages", directory, "package.json"), "utf8"),
    );
    if (!manifest.name?.startsWith("@windstack/")) {
      throw new Error(`Unexpected workspace package name in packages/${directory}`);
    }
    if (manifest.version !== rootManifest.version) {
      throw new Error(`${manifest.name} does not match root version ${rootManifest.version}`);
    }
    manifests.push({ directory, manifest });
  }
  return manifests;
}

function dependencyNames(manifest) {
  return new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ]);
}

function sortForPublish(entries) {
  const byName = new Map(entries.map((entry) => [entry.manifest.name, entry]));
  const ordered = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(entry) {
    const name = entry.manifest.name;
    if (visited.has(name)) return;
    if (visiting.has(name)) throw new Error(`Circular release dependency detected at ${name}`);
    visiting.add(name);

    const internalDependencies = [...dependencyNames(entry.manifest)]
      .filter((dependency) => byName.has(dependency))
      .sort();
    for (const dependency of internalDependencies) visit(byName.get(dependency));

    visiting.delete(name);
    visited.add(name);
    ordered.push(entry);
  }

  for (const entry of [...entries].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name))) {
    visit(entry);
  }
  return ordered;
}

function publishedVersion(name, version) {
  const result = run(
    "npm",
    ["view", `${name}@${version}`, "version", "--json", "--registry", registry],
    { capture: true, allowFailure: true },
  );
  if (result.status === 0) {
    const parsed = JSON.parse(result.stdout || "null");
    return parsed === version;
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/E404|404 Not Found|No match found for version/i.test(output)) return false;
  throw new Error(`Unable to query npm for ${name}@${version}: ${output.trim()}`);
}

async function waitForPublishedVersion(name, version) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (publishedVersion(name, version)) return;
    await sleep(2000);
  }
  throw new Error(`npm did not confirm ${name}@${version} after publish`);
}

requireReleaseState();
const releaseEntries = sortForPublish(await loadReleaseManifests());
console.log(
  `WindStack publish order:\n${releaseEntries.map(({ manifest }) => `- ${manifest.name}@${manifest.version}`).join("\n")}`,
);

run("npm", ["whoami"]);
run("npm", ["run", "release:dry-run"]);

for (const { manifest } of releaseEntries) {
  const { name, version } = manifest;
  if (publishedVersion(name, version)) {
    console.log(`${name}@${version} is already published; skipping.`);
    continue;
  }

  console.log(`Publishing ${name}@${version}...`);
  run("npm", [
    "publish",
    "--workspace",
    name,
    "--access",
    "public",
    "--registry",
    registry,
  ]);
  await waitForPublishedVersion(name, version);
}

for (const { manifest } of releaseEntries) {
  if (!publishedVersion(manifest.name, manifest.version)) {
    throw new Error(`Final registry verification failed for ${manifest.name}@${manifest.version}`);
  }
}

console.log("All WindStack 1.0 release packages are published and verified.");
