/**
 * WindStack SDK
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
const visibilityAttempts = 240;
const visibilityIntervalMs = 5_000;
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

async function resolveNpmToken() {
  const environmentToken = process.env.NPM_TOKEN?.trim();
  if (environmentToken) return environmentToken;

  const userconfig = execFileSync("npm", ["config", "get", "userconfig"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  if (!userconfig) throw new Error("Unable to resolve npm user configuration");

  const npmrc = await readFile(userconfig, "utf8");
  const match = npmrc.match(/^\/\/registry\.npmjs\.org\/:_authToken=(.+)$/m);
  if (!match) throw new Error("npm registry token is not configured");

  let token = match[1].trim();
  const variable = token.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  if (variable) token = process.env[variable[1]]?.trim() ?? "";
  if (!token) throw new Error("npm registry token resolved to an empty value");
  return token;
}

async function publishedVersion(name, version) {
  let response;
  try {
    response = await fetch(`${registry}${encodeURIComponent(name)}`, {
      headers: { accept: "application/json", "cache-control": "no-cache" },
    });
  } catch (error) {
    throw new Error(`Unable to query npm for ${name}@${version}: ${error.message}`);
  }
  if (response.status === 404) return false;
  if (response.status !== 200) {
    throw new Error(`Unable to query npm for ${name}@${version}: HTTP ${response.status}`);
  }

  const packument = await response.json();
  return Object.hasOwn(packument.versions ?? {}, version);
}

async function waitForPublishedVersions(entries) {
  let pending = entries;
  for (let attempt = 1; attempt <= visibilityAttempts; attempt += 1) {
    const checks = await Promise.all(
      pending.map(async (entry) => ({
        entry,
        published: await publishedVersion(entry.manifest.name, entry.manifest.version),
      })),
    );
    pending = checks.filter(({ published }) => !published).map(({ entry }) => entry);
    if (!pending.length) return;
    if (attempt === 1 || attempt % 12 === 0) {
      console.log(
        `Waiting for npm package visibility (${pending.length} remaining): ${pending
          .map(({ manifest }) => `${manifest.name}@${manifest.version}`)
          .join(", ")}`,
      );
    }
    await sleep(visibilityIntervalMs);
  }
  throw new Error(
    `npm did not make these versions public within 20 minutes: ${pending
      .map(({ manifest }) => `${manifest.name}@${manifest.version}`)
      .join(", ")}`,
  );
}

requireReleaseState();
const releaseEntries = sortForPublish(await loadReleaseManifests());
console.log(
  `WindStack publish order:\n${releaseEntries.map(({ manifest }) => `- ${manifest.name}@${manifest.version}`).join("\n")}`,
);

await resolveNpmToken();
console.log("npm publishing credential is configured.");
run("npm", ["run", "release:dry-run"]);

const conflicts = [];
for (const { manifest } of releaseEntries) {
  const { name, version } = manifest;
  if (await publishedVersion(name, version)) {
    conflicts.push(`${name}@${version} is already public`);
  }
}
if (conflicts.length) {
  throw new Error(`Refusing to overwrite an existing release:\n${conflicts.join("\n")}`);
}

for (const { manifest } of releaseEntries) {
  const { name, version } = manifest;
  console.log(`Publishing ${name}@${version}...`);
  run("npm", ["publish", "--workspace", name, "--access", "public", "--registry", registry]);
}

await waitForPublishedVersions(releaseEntries);

console.log(
  `All WindStack ${releaseEntries[0]?.manifest.version ?? "release"} packages are published and verified.`,
);
