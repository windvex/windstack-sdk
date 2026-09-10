import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releasePackages = [
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
const nativePackages = [
  "crypto",
  "abi",
  "rpc",
  "contract",
  "account",
  "antelope",
  "signing-request",
  "session",
];
const forbiddenDependencies = ["elliptic", "bn.js", "crypto-browserify", "randombytes"];
const forbiddenPublicKeywords = new Set(["wharfkit", "sessionkit", "eos", "eosio"]);
const requiredReadmeSections = [
  "## Overview",
  "## Installation",
  "## Usage",
  "## Runtime",
  "## License",
];
const requiredMarkdownSections = ["## Overview", "## License"];
const creatorPattern = /Created by (?:\*\*)?Gilang Ramadan/;
const copyrightPattern = /Copyright © 2026 PT WIND KRIPTOGRAFI TEKNOLOGI/;
const sourceHeader = `/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */`;

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (["node_modules", "dist", ".git"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

function dependencySections(manifest) {
  return [
    manifest.dependencies ?? {},
    manifest.optionalDependencies ?? {},
    manifest.peerDependencies ?? {},
    manifest.devDependencies ?? {},
  ];
}

function assertDependencyAllowed(owner, dependency) {
  assert.ok(!dependency.startsWith("@wharfkit/"), `${owner} cannot depend on ${dependency}`);
  assert.ok(!forbiddenDependencies.includes(dependency), `${owner} cannot depend on ${dependency}`);
}

const rootPackage = await readJson("package.json");
assert.equal(rootPackage.private, true, "Root package must remain private");
assert.match(rootPackage.version, /^\d+\.\d+\.\d+$/, "Root version must be semantic");

function git(args, allowFailure = false) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch (error) {
    if (allowFailure) return "";
    throw error;
  }
}

const releaseRelevant =
  /^(?:packages\/[^/]+\/(?:src\/|package\.json|README\.md|tsconfig\.json)|package(?:-lock)?\.json|README\.md|CHANGELOG\.md|docs\/|specs\/|test\/fixtures\/|tsconfig(?:\.base)?\.json|scripts\/(?:check-release|publish-release|audit-release-tarballs|verify-vexanium)\.mjs|\.github\/workflows\/)/;
const dirtyFiles = git(["status", "--porcelain"])
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3));
const configuredBaseline = process.env.RELEASE_BASE_REF?.trim();
const latestReleaseTag = git(
  ["describe", "--tags", "--match", "v[0-9]*", "--abbrev=0"],
  true,
);
const baseline =
  configuredBaseline && !/^0+$/.test(configuredBaseline)
    ? configuredBaseline
    : dirtyFiles.length
      ? "HEAD"
      : latestReleaseTag || "HEAD^";
const changedFiles = dirtyFiles.length
  ? dirtyFiles
  : git(["diff", "--name-only", baseline, "HEAD"], true).split("\n").filter(Boolean);
if (changedFiles.some((file) => releaseRelevant.test(file))) {
  const baselineManifest = git(["show", `${baseline}:package.json`], true);
  if (!baselineManifest) {
    throw new Error(
      `Cannot verify the release version against ${baseline}; fetch release history first`,
    );
  }
  const baselineVersion = JSON.parse(baselineManifest).version;
  assert.notEqual(
    rootPackage.version,
    baselineVersion,
    `Release-relevant files changed but version remains ${rootPackage.version}`,
  );
}

const packageDirectories = (await readdir(path.join(root, "packages"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.deepEqual(
  packageDirectories,
  [...releasePackages].sort(),
  "Every package workspace must be part of the coordinated release",
);

const manifests = new Map();
for (const packageDirectory of releasePackages) {
  const manifest = await readJson(`packages/${packageDirectory}/package.json`);
  assert.equal(manifest.name, `@windstack/${packageDirectory}`);
  manifests.set(manifest.name, manifest);
  assert.equal(
    manifest.version,
    rootPackage.version,
    `${manifest.name} must use the root release version`,
  );
  assert.equal(manifest.author, "Gilang Ramadan", `${manifest.name} author must be Gilang Ramadan`);
  assert.equal(manifest.license, "MIT", `${manifest.name} must use MIT`);
  assert.equal(manifest.publishConfig?.access, "public", `${manifest.name} must publish as public`);
  assert.equal(
    manifest.publishConfig?.registry,
    "https://registry.npmjs.org/",
    `${manifest.name} must use the public npm registry`,
  );
  assert.equal(typeof manifest.description, "string", `${manifest.name} must have a description`);
  assert.ok(manifest.description.trim().length >= 20, `${manifest.name} description is too short`);
  assert.doesNotMatch(
    manifest.description,
    /\b(?:WharfKit|EOSIO|EOS)\b/i,
    `${manifest.name} description contains legacy branding`,
  );
  assert.equal(manifest.main, "./dist/index.js", `${manifest.name} main entry is invalid`);
  assert.equal(manifest.types, "./dist/index.d.ts", `${manifest.name} type entry is invalid`);
  assert.ok(manifest.exports?.["."], `${manifest.name} must export its primary entrypoint`);
  assert.equal(
    manifest.repository?.directory,
    `packages/${packageDirectory}`,
    `${manifest.name} repository directory is invalid`,
  );
  assert.equal(
    manifest.homepage,
    `https://github.com/windvex/windstack-sdk/tree/main/packages/${packageDirectory}#readme`,
    `${manifest.name} homepage is invalid`,
  );
  assert.equal(
    manifest.bugs?.url,
    "https://github.com/windvex/windstack-sdk/issues",
    `${manifest.name} bugs URL is invalid`,
  );
  assert.equal(manifest.engines?.node, ">=20.19.0", `${manifest.name} Node requirement is invalid`);
  assert.equal(manifest.sideEffects, false, `${manifest.name} must declare sideEffects=false`);
  assert.ok(
    Array.isArray(manifest.files) && manifest.files.includes("dist"),
    `${manifest.name} must publish dist`,
  );
  assert.ok(
    manifest.files.includes("README.md") && manifest.files.includes("LICENSE"),
    `${manifest.name} must publish documentation and license`,
  );
  for (const keyword of manifest.keywords ?? []) {
    assert.ok(
      !forbiddenPublicKeywords.has(String(keyword).toLowerCase()),
      `${manifest.name} contains legacy public keyword ${keyword}`,
    );
  }

  const readme = await readFile(path.join(root, `packages/${packageDirectory}/README.md`), "utf8");
  assert.ok(readme.startsWith(`# ${manifest.name}\n`), `${manifest.name} README title is invalid`);
  for (const section of requiredReadmeSections) {
    assert.ok(readme.includes(section), `${manifest.name} README is missing ${section}`);
  }
  if (["crypto", "rpc", "antelope", "signing-request", "session"].includes(packageDirectory)) {
    assert.ok(readme.includes("## Security"), `${manifest.name} README is missing ## Security`);
  }
  assert.match(readme, creatorPattern, `${manifest.name} README must credit Gilang Ramadan`);
  assert.match(readme, copyrightPattern, `${manifest.name} README copyright is missing`);
  await access(path.join(root, `packages/${packageDirectory}/LICENSE`));
}

const visiting = new Set();
const visited = new Set();
function visitRelease(name) {
  if (visiting.has(name)) throw new TypeError(`Circular release dependency detected at ${name}`);
  if (visited.has(name)) return;
  visiting.add(name);
  for (const dependency of Object.keys(manifests.get(name)?.dependencies ?? {})) {
    if (manifests.has(dependency)) visitRelease(dependency);
  }
  visiting.delete(name);
  visited.add(name);
}
for (const name of manifests.keys()) visitRelease(name);

for (const [name, manifest] of manifests) {
  for (const section of dependencySections(manifest)) {
    for (const [dependency, version] of Object.entries(section)) {
      assertDependencyAllowed(name, dependency);
      if (manifests.has(dependency) && dependency.startsWith("@windstack/")) {
        assert.equal(
          version,
          rootPackage.version,
          `${name} must pin ${dependency} to ${rootPackage.version}`,
        );
      }
    }
  }
}

const sourceChecks = (
  await Promise.all(
    nativePackages.map(async (packageDirectory) =>
      (
        await walk(path.join(root, "packages", packageDirectory, "src"))
      )
        .filter((file) => file.endsWith(".ts"))
        .map((file) => path.relative(root, file)),
    ),
  )
).flat();
for (const relativePath of sourceChecks) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  assert.ok(source.startsWith(sourceHeader), `${relativePath} must include creator attribution`);
  assert.doesNotMatch(source, /@wharfkit\//, `${relativePath} cannot import WharfKit`);
  assert.doesNotMatch(source, /\bMath\.random\s*\(/, `${relativePath} cannot use Math.random`);
  if (relativePath !== "packages/antelope/src/node.ts") {
    assert.doesNotMatch(
      source,
      /(?:from\s+["']node:|\bBuffer\b)/,
      `${relativePath} must remain portable`,
    );
  }
}

const vexaniumPreset = (
  await Promise.all([
    ...["antelope.ts", "chains.ts", "constants.ts"].map((file) =>
      readFile(path.join(root, "packages/vexanium/src", file), "utf8"),
    ),
    readFile(path.join(root, "specs/wisp-provider-contract.json"), "utf8"),
  ])
).join("\n");
for (const expected of [
  "Vexanium Mainnet",
  "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
  "https://api.windcrypto.com",
  '"vexcore"',
  '"vex.token"',
  '"VEX"',
  "precision: 4",
  'VEXANIUM_LEGACY_PUBLIC_KEY_PREFIX = "VEX"',
]) {
  assert.ok(vexaniumPreset.includes(expected), `Vexanium preset is missing ${expected}`);
}

const markdownFiles = (await walk(root)).filter((file) => file.endsWith(".md"));
for (const file of markdownFiles) {
  const content = await readFile(file, "utf8");
  const relativePath = path.relative(root, file);
  for (const section of requiredMarkdownSections) {
    assert.ok(content.includes(section), `${relativePath} is missing ${section}`);
  }
  assert.match(content, creatorPattern, `${relativePath} must credit Gilang Ramadan`);
  assert.match(content, copyrightPattern, `${relativePath} copyright is missing`);
}

const lock = await readJson("package-lock.json");
assert.equal(
  lock.version,
  rootPackage.version,
  "package-lock root version must match package.json",
);
assert.equal(
  lock.packages?.[""]?.version,
  rootPackage.version,
  "package-lock root package version is stale",
);
for (const packageDirectory of releasePackages) {
  const manifest = await readJson(`packages/${packageDirectory}/package.json`);
  const lockManifest = lock.packages?.[`packages/${packageDirectory}`];
  assert.ok(lockManifest, `package-lock is missing ${manifest.name}`);
  assert.equal(
    lockManifest.version,
    manifest.version,
    `package-lock entry for ${manifest.name} is stale`,
  );
  for (const sectionName of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
  ]) {
    assert.deepEqual(
      lockManifest?.[sectionName] ?? {},
      manifest?.[sectionName] ?? {},
      `package-lock ${sectionName} for ${manifest.name} is stale`,
    );
    for (const dependency of Object.keys(lockManifest?.[sectionName] ?? {})) {
      assertDependencyAllowed(`${manifest.name} lockfile`, dependency);
    }
  }
}

const reachable = new Set();
function visitDependency(name) {
  if (reachable.has(name)) return;
  reachable.add(name);
  const manifest = manifests.get(name);
  const dependencies =
    manifest?.dependencies ?? lock.packages?.[`node_modules/${name}`]?.dependencies ?? {};
  for (const dependency of Object.keys(dependencies)) visitDependency(dependency);
}
for (const manifest of manifests.values()) {
  for (const dependency of Object.keys(manifest.dependencies ?? {})) visitDependency(dependency);
}
for (const dependency of reachable) {
  assertDependencyAllowed("Release dependency graph", dependency);
}

console.log(
  `Release guard passed for ${releasePackages.length} WindStack packages at ${rootPackage.version}`,
);
