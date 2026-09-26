/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyCurrentCandidate } from "./release-artifacts.mjs";

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

const candidate = await verifyCurrentCandidate();
const packageByName = new Map(candidate.packages.map((entry) => [entry.name, entry]));

for (const { manifest } of candidate.entries) {
  const artifact = packageByName.get(manifest.name);
  assert.ok(artifact, `Missing candidate artifact for ${manifest.name}`);

  const entries = execFileSync("tar", ["-tzf", artifact.filePath], { encoding: "utf8" })
    .trim()
    .split("\n");
  for (const required of [
    "package/package.json",
    "package/README.md",
    "package/LICENSE",
    "package/dist/index.js",
    "package/dist/index.d.ts",
  ]) {
    assert.ok(entries.includes(required), `${manifest.name} tarball is missing ${required}`);
  }

  for (const conditions of Object.values(manifest.exports ?? {})) {
    if (typeof conditions === "string") {
      assert.ok(
        entries.includes(`package/${conditions.replace(/^\.\//u, "")}`),
        `${manifest.name} tarball is missing exported file ${conditions}`,
      );
      continue;
    }
    for (const target of Object.values(conditions ?? {})) {
      assert.equal(typeof target, "string", `${manifest.name} has an invalid export target`);
      assert.ok(
        entries.includes(`package/${target.replace(/^\.\//u, "")}`),
        `${manifest.name} tarball is missing exported file ${target}`,
      );
    }
  }

  for (const entry of entries) {
    assert.ok(
      !/^package\/(?:src|scripts|test|\.github|\.env)/u.test(entry),
      `${manifest.name} publishes private/development file ${entry}`,
    );
    assert.ok(!entry.endsWith(".tsbuildinfo"), `${manifest.name} publishes ${entry}`);
  }

  const packedManifest = JSON.parse(
    execFileSync("tar", ["-xOf", artifact.filePath, "package/package.json"], {
      encoding: "utf8",
    }),
  );
  assert.equal(packedManifest.name, manifest.name);
  assert.equal(packedManifest.version, manifest.version);
}

const directory = await mkdtemp(path.join(tmpdir(), "windstack-candidate-audit-"));
try {
  const dependencies = Object.fromEntries(
    candidate.packages.map((entry) => [entry.name, `file:${entry.filePath}`]),
  );
  await writeFile(
    path.join(directory, "package.json"),
    `${JSON.stringify(
      {
        name: "windstack-candidate-consumer",
        version: "1.0.0",
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    )}\n`,
  );

  const exportedEntries = candidate.entries.flatMap(({ manifest }) =>
    Object.keys(manifest.exports ?? { ".": {} }).map((entry) =>
      entry === "." ? manifest.name : `${manifest.name}/${entry.replace(/^\.\//u, "")}`,
    ),
  );
  const smoke = `
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageNames = ${JSON.stringify(candidate.entries.map(({ manifest }) => manifest.name))};
const exportedEntries = ${JSON.stringify(exportedEntries)};
const version = ${JSON.stringify(candidate.rootManifest.version)};

for (const name of packageNames) {
  const module = await import(name);
  assert.ok(Object.keys(module).length > 0, \`\${name} must expose a public module\`);
  const manifest = JSON.parse(
    await readFile(new URL(\`./node_modules/\${name}/package.json\`, import.meta.url), "utf8"),
  );
  assert.equal(manifest.version, version, \`\${name} must install at candidate version\`);
}

for (const entry of exportedEntries) {
  const module = await import(entry);
  assert.ok(module && typeof module === "object", \`\${entry} must be importable\`);
}

const antelopeMain = await readFile(
  new URL("./node_modules/@windstack/antelope/dist/index.js", import.meta.url),
  "utf8",
);
assert.doesNotMatch(antelopeMain, /node:|Buffer/u, "browser entrypoint must not import Node APIs");

console.log("Exact candidate tarballs imported successfully");
`;
  await writeFile(path.join(directory, "smoke.mjs"), smoke.trimStart());

  run("npm", ["install", "--ignore-scripts", "--no-fund", "--no-audit"], directory);
  run("npm", ["ls", "--all"], directory);
  run("node", ["smoke.mjs"], directory);
  run("npm", ["audit", "--omit=dev"], directory);

  const lockText = await readFile(path.join(directory, "package-lock.json"), "utf8");
  for (const dependency of forbiddenDependencies) {
    assert.ok(!lockText.includes(dependency), `Consumer lockfile contains ${dependency}`);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log(
  `Exact release candidate audit passed for ${candidate.packages.length} immutable tarballs`,
);
