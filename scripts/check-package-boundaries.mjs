import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const genericPackages = [
  "core",
  "crypto",
  "abi",
  "rpc",
  "contract",
  "account",
  "antelope",
  "session",
  "evm",
  "solana",
];

const forbiddenDependencies = new Set(["@windstack/vexanium", "@windstack/wallet-plugin-wisp"]);

const forbiddenSourcePatterns = [
  { label: "Wisp runtime coupling", pattern: /\bwisp\b/iu },
  { label: "WindSwap coupling", pattern: /\bwind[- ]?swap\b/iu },
  { label: "Wind Launch coupling", pattern: /\bwind[- ]?launch\b/iu },
  { label: "Wisp Arena coupling", pattern: /\bwisp[- ]?arena\b/iu },
  { label: "Wisp Space Run coupling", pattern: /\bwisp[- ]?space[- ]?run\b/iu },
  { label: "Wisp Tip coupling", pattern: /\bwisp[- ]?tip\b/iu },
  { label: "WindCrypto endpoint coupling", pattern: /\bwindcrypto\.com\b/iu },
  { label: "Vexanium package coupling", pattern: /@windstack\/vexanium/iu },
  { label: "Vexanium runtime coupling", pattern: /\bvexanium\b/iu },
  { label: "VEX token contract coupling", pattern: /\bvex\.token\b/iu },
  { label: "VEX system contract coupling", pattern: /\bvexcore\b/iu },
  {
    label: "VEX Mainnet chain coupling",
    pattern: /f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f/iu,
  },
];

// Exceptions must be path + rule-label pairs and require an architectural reason.
// Keep empty unless a generic primitive objectively cannot avoid the reference.
const boundaryExceptions = new Set();

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

function isExcepted(relativePath, label) {
  return boundaryExceptions.has(`${relativePath}::${label}`);
}

const violations = [];

for (const packageName of genericPackages) {
  const packageRoot = path.join(root, "packages", packageName);
  const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));

  for (const sectionName of [
    "dependencies",
    "optionalDependencies",
    "peerDependencies",
    "devDependencies",
  ]) {
    for (const dependency of Object.keys(manifest[sectionName] ?? {})) {
      if (forbiddenDependencies.has(dependency)) {
        violations.push(
          `packages/${packageName}/package.json: ${sectionName} cannot include ${dependency}`,
        );
      }
    }
  }

  const sourceRoot = path.join(packageRoot, "src");
  const files = (await walk(sourceRoot)).filter((file) => file.endsWith(".ts"));
  for (const file of files) {
    const relativePath = path.relative(root, file).replaceAll(path.sep, "/");
    const source = await readFile(file, "utf8");
    for (const { label, pattern } of forbiddenSourcePatterns) {
      if (pattern.test(source) && !isExcepted(relativePath, label)) {
        violations.push(`${relativePath}: ${label}`);
      }
      pattern.lastIndex = 0;
    }
  }
}

assert.equal(
  boundaryExceptions.size,
  0,
  "Generic package boundary exceptions require explicit review before release",
);

if (violations.length) {
  console.error("Generic package boundary guard failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `Generic package boundary guard passed for ${genericPackages.length} framework-neutral packages.`,
);
