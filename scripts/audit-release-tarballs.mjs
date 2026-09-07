/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectories = [
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
const forbiddenDependencies = [
  "@wharfkit/",
  "elliptic",
  "bn.js",
  "crypto-browserify",
  "randombytes",
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function tarballFilename(name, version) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`;
}

const directory = await mkdtemp(path.join(tmpdir(), "windstack-release-audit-"));
const tarballsDirectory = path.join(directory, "tarballs");
const consumerDirectory = path.join(directory, "consumer");

try {
  await mkdir(tarballsDirectory, { recursive: true });
  await mkdir(consumerDirectory, { recursive: true });

  const manifests = [];
  for (const packageDirectory of packageDirectories) {
    const manifest = JSON.parse(
      await readFile(path.join(root, "packages", packageDirectory, "package.json"), "utf8"),
    );
    manifests.push(manifest);
    run(
      "npm",
      ["pack", "--workspace", manifest.name, "--pack-destination", tarballsDirectory],
      root,
    );
    await access(path.join(tarballsDirectory, tarballFilename(manifest.name, manifest.version)));
  }

  const dependencies = Object.fromEntries(
    manifests.map((manifest) => [
      manifest.name,
      `file:../tarballs/${tarballFilename(manifest.name, manifest.version)}`,
    ]),
  );

  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify(
      {
        name: "windstack-release-consumer",
        version: "1.0.0",
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    )}\n`,
  );

  const smokeTest = `
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageNames = ${JSON.stringify(
    manifests.map((manifest) => manifest.name),
    null,
    2,
  )};

for (const name of packageNames) {
  const module = await import(name);
  assert.ok(Object.keys(module).length > 0, \`\${name} must expose a public module\`);
  const manifest = JSON.parse(
    await readFile(new URL(\`./node_modules/\${name}/package.json\`, import.meta.url), "utf8"),
  );
  assert.equal(manifest.version, "1.0.0", \`\${name} must install at 1.0.0\`);
}

const antelope = await import("@windstack/antelope");
assert.equal(typeof antelope.PrivateKeySigner, "function");

const vexaniumPreset = await import("@windstack/antelope/vexanium");
assert.equal(
  vexaniumPreset.VEXANIUM_MAINNET.chainId,
  "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
);
assert.equal(vexaniumPreset.VEXANIUM_MAINNET.contracts.system, "vexcore");
assert.equal(vexaniumPreset.VEXANIUM_MAINNET.contracts.token, "vex.token");

const signingRequest = await import("@windstack/signing-request");
assert.equal(typeof signingRequest.SigningRequest, "function");

const session = await import("@windstack/session");
assert.equal(typeof session.SessionManager, "function");

const vexanium = await import("@windstack/vexanium");
assert.equal(typeof vexanium.createSigningRequest, "function");

const wisp = await import("@windstack/wallet-plugin-wisp");
assert.equal(typeof wisp.WispWalletPlugin, "function");

console.log("Installed release tarballs imported successfully");
`;
  await writeFile(path.join(consumerDirectory, "smoke.mjs"), smokeTest.trimStart());

  run("npm", ["install", "--ignore-scripts", "--no-fund", "--no-audit"], consumerDirectory);
  run("npm", ["ls", "--all"], consumerDirectory);
  run("node", ["smoke.mjs"], consumerDirectory);
  run("npm", ["audit", "--omit=dev"], consumerDirectory);

  const lockText = await readFile(path.join(consumerDirectory, "package-lock.json"), "utf8");
  for (const dependency of forbiddenDependencies) {
    assert.ok(!lockText.includes(dependency), `Consumer lockfile contains ${dependency}`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log(`Release tarball consumer audit passed for ${packageDirectories.length} packages`);
