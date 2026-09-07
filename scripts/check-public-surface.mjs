import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicCopyRules = [
  [/\bAI\b/i, "AI wording"],
  [/\b(?:ChatGPT|Codex)\b/i, "assistant-tool wording"],
  [/\b(?:technical|teknis|engineering)\b/i, "internal-work wording"],
  [/\bdevelopers?\b/i, "developer-oriented filler"],
  [/\b(?:internal note|engineering note|technical note|developer note)\b/i, "internal note"],
  [/\b(?:TODO|FIXME|HACK)\b/, "unfinished-work marker"],
  [/\b(?:VPS|npm whoami|release:npm)\b/i, "deployment instruction"],
  [/\b(?:migration scratchpad|release scratchpad)\b/i, "scratchpad wording"],
  [/\b(?:generated|written|built) by (?:an )?AI\b/i, "generated-content wording"],
  [/\b(?:WharfKit|SessionKit)\b/i, "legacy library branding"],
  [/\b(?:EOSIO|EOS)\b/i, "legacy chain branding"],
];
const packageKeywordRules = [
  /^(?:windstack|vexanium|vex|vex-evm|antelope|wisp|wisp-wallet|wallet|wallet-plugin|provider|session|signing|signatures|signing-request|vsr|esr|cryptography|secp256k1|p256|abi|serialization|binary|rpc|nodeos|fetch|contract|account|staking|ram|voting|transaction|tapos|evm|eip-1193|eip-6963|solana|wallet-standard|typescript)$/,
];

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else files.push(target);
  }
  return files;
}

function checkCopy(label, text) {
  for (const [pattern, description] of publicCopyRules) {
    assert.doesNotMatch(text, pattern, `${label} contains ${description}`);
  }
}

const markdownFiles = (await walk(root)).filter((file) => file.endsWith(".md"));
for (const file of markdownFiles) {
  checkCopy(path.relative(root, file), await readFile(file, "utf8"));
}

const packageDirectories = (await readdir(path.join(root, "packages"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const directory of packageDirectories) {
  const manifestPath = path.join(root, "packages", directory, "package.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  checkCopy(`${manifest.name} description`, String(manifest.description ?? ""));

  assert.ok(Array.isArray(manifest.keywords), `${manifest.name} must define npm keywords`);
  assert.ok(
    manifest.keywords.length >= 5 && manifest.keywords.length <= 12,
    `${manifest.name} must define between 5 and 12 npm keywords`,
  );
  const normalized = manifest.keywords.map((keyword) => String(keyword).trim().toLowerCase());
  assert.equal(new Set(normalized).size, normalized.length, `${manifest.name} has duplicate keywords`);
  assert.ok(normalized.includes("windstack"), `${manifest.name} keywords must include windstack`);
  for (const keyword of normalized) {
    assert.ok(packageKeywordRules.some((pattern) => pattern.test(keyword)), `${manifest.name} has unsupported keyword ${keyword}`);
  }
}

const readme = await readFile(path.join(root, "README.md"), "utf8");
for (const heading of [
  "## Overview",
  "## Installation",
  "## Usage",
  "## Vexanium Mainnet",
  "## Runtime",
  "## Reliability",
  "## Documentation",
  "## License",
]) {
  assert.ok(readme.includes(heading), `README.md is missing ${heading}`);
}

console.log(`Public surface check passed for ${packageDirectories.length} packages and ${markdownFiles.length} Markdown files`);
