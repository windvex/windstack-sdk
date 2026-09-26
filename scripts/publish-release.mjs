/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { git, root, sortForPublish, verifyCurrentCandidate } from "./release-artifacts.mjs";

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

function requireReleaseState() {
  const branch = git(["branch", "--show-current"]);
  if (branch !== "main") {
    throw new Error(`Release must run from main; current branch is ${branch || "detached"}`);
  }
  if (git(["status", "--porcelain"])) throw new Error("Release requires a clean working tree");

  const head = git(["rev-parse", "HEAD"]);
  const remoteHead = git(["rev-parse", "origin/main"], { allowFailure: true });
  if (remoteHead && head !== remoteHead) {
    throw new Error("Release requires local main to match origin/main exactly");
  }
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
  const match = npmrc.match(/^\/\/registry\.npmjs\.org\/:_authToken=(.+)$/mu);
  if (!match) throw new Error("npm registry token is not configured");

  let token = match[1].trim();
  const variable = token.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/u);
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
    `npm did not make all packages public within 20 minutes: ${pending
      .map(({ manifest }) => `${manifest.name}@${manifest.version}`)
      .join(", ")}`,
  );
}

requireReleaseState();
const candidate = await verifyCurrentCandidate();
const artifactByName = new Map(candidate.packages.map((entry) => [entry.name, entry]));
const ordered = sortForPublish(candidate.entries);

console.log(
  `WindStack exact-artifact publish order:\n${ordered
    .map(({ manifest }) => {
      const artifact = artifactByName.get(manifest.name);
      return `- ${manifest.name}@${manifest.version} <- ${artifact.filename}`;
    })
    .join("\n")}`,
);

await resolveNpmToken();
console.log("npm publishing credential is configured.");

run("npm", ["run", "candidate:verify"]);
run("npm", ["run", "audit:release"]);
run("npm", ["run", "verify:vexanium"]);
run("npm", ["audit"]);
run("npm", ["run", "audit:native"]);

const conflicts = [];
for (const { manifest } of ordered) {
  if (await publishedVersion(manifest.name, manifest.version)) {
    conflicts.push(`${manifest.name}@${manifest.version} is already public`);
  }
}
if (conflicts.length) {
  throw new Error(`Refusing to overwrite an existing release:\n${conflicts.join("\n")}`);
}

for (const { manifest } of ordered) {
  const artifact = artifactByName.get(manifest.name);
  if (!artifact) throw new Error(`Missing immutable artifact for ${manifest.name}`);
  console.log(`Publishing exact artifact ${artifact.filename}...`);
  run("npm", ["publish", artifact.filePath, "--access", "public", "--registry", registry]);
}

await waitForPublishedVersions(ordered);
console.log(
  `All WindStack ${candidate.manifest.version} packages were published from the verified candidate tarballs.`,
);
