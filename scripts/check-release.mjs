import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nativePackages = ["crypto", "abi", "rpc", "contract", "account", "antelope", "session"];
const forbiddenDependencies = ["elliptic", "bn.js", "crypto-browserify"];
const forbiddenMarkdown = [
  { pattern: /\bAI\b/i, label: "AI wording" },
  { pattern: /\bengineering\b/i, label: "engineering wording" },
  { pattern: /\btechnical\b/i, label: "technical wording" },
  { pattern: /\bteknis\b/i, label: "teknis wording" },
  { pattern: /Publish native packages from VPS/i, label: "deployment note" },
  { pattern: /npm whoami/i, label: "npm authentication note" },
  { pattern: /release:npm/i, label: "release command" },
  { pattern: /not (?:a )?WharfKit fork/i, label: "implementation comparison" },
];
const requiredReadmeSections = ["## Overview", "## Installation", "## Usage", "## Runtime", "## License"];
const header = "Created by Gilang Ramadan";

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

const rootPackage = await readJson("package.json");
assert.equal(rootPackage.private, true, "Root package must remain private");
assert.match(rootPackage.version, /^\d+\.\d+\.\d+$/, "Root version must be semantic");

const manifests = new Map();
for (const packageDirectory of nativePackages) {
  const manifest = await readJson(`packages/${packageDirectory}/package.json`);
  manifests.set(manifest.name, manifest);
  assert.equal(manifest.version, rootPackage.version, `${manifest.name} must use the root release version`);
  assert.equal(manifest.author, "Gilang Ramadan", `${manifest.name} author must be Gilang Ramadan`);
  assert.equal(manifest.license, "MIT", `${manifest.name} must use MIT`);
  assert.equal(manifest.publishConfig?.access, "public", `${manifest.name} must publish as public`);
  assert.equal(manifest.sideEffects, false, `${manifest.name} must declare sideEffects=false`);
  assert.ok(Array.isArray(manifest.files) && manifest.files.includes("dist"), `${manifest.name} must publish dist`);
  assert.ok(manifest.files.includes("README.md") && manifest.files.includes("LICENSE"), `${manifest.name} must publish documentation and license`);

  const readme = await readFile(path.join(root, `packages/${packageDirectory}/README.md`), "utf8");
  assert.ok(readme.startsWith(`# ${manifest.name}\n`), `${manifest.name} README title is invalid`);
  for (const section of requiredReadmeSections) {
    assert.ok(readme.includes(section), `${manifest.name} README is missing ${section}`);
  }
  assert.ok(readme.includes(header), `${manifest.name} README must credit Gilang Ramadan`);
}

for (const [name, manifest] of manifests) {
  for (const [dependency, version] of Object.entries(manifest.dependencies ?? {})) {
    assert.ok(!dependency.startsWith("@wharfkit/"), `${name} cannot depend on ${dependency}`);
    assert.ok(!forbiddenDependencies.includes(dependency), `${name} cannot depend on ${dependency}`);
    if (manifests.has(dependency)) {
      assert.equal(version, rootPackage.version, `${name} must pin ${dependency} to ${rootPackage.version}`);
    }
  }
}

const sourceChecks = [
  "packages/crypto/src/index.ts",
  "packages/abi/src/index.ts",
  "packages/rpc/src/index.ts",
  "packages/contract/src/index.ts",
  "packages/account/src/index.ts",
  "packages/antelope/src/index.ts",
  "packages/session/src/index.ts",
  "packages/session/src/native.ts",
  "packages/session/src/compat.ts",
];
for (const relativePath of sourceChecks) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  assert.ok(source.includes(header), `${relativePath} must include creator attribution`);
}

const markdownFiles = (await walk(root)).filter((file) => file.endsWith(".md"));
for (const file of markdownFiles) {
  const content = await readFile(file, "utf8");
  for (const { pattern, label } of forbiddenMarkdown) {
    assert.ok(!pattern.test(content), `${path.relative(root, file)} contains ${label}`);
  }
}

const lock = await readJson("package-lock.json");
assert.equal(lock.version, rootPackage.version, "package-lock root version must match package.json");
assert.equal(lock.packages?.[""]?.version, rootPackage.version, "package-lock root package version is stale");
for (const packageDirectory of nativePackages) {
  const manifest = await readJson(`packages/${packageDirectory}/package.json`);
  assert.equal(
    lock.packages?.[`packages/${packageDirectory}`]?.version,
    manifest.version,
    `package-lock entry for ${manifest.name} is stale`,
  );
}

console.log(`Release guard passed for WindStack ${rootPackage.version}`);
