/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  git,
  loadReleaseEntries,
  packageDirectories,
  releaseRoot,
  root,
} from "./release-artifacts.mjs";

const { rootManifest: candidateManifest } = await loadReleaseEntries();

function resolveApiBaseline() {
  const configured = process.env.API_BASE_TAG?.trim();
  if (configured) return configured;

  const tags = git(["tag", "--list", "v[0-9]*", "--sort=-version:refname"], {
    allowFailure: true,
  })
    .split("\n")
    .filter(Boolean);

  for (const tag of tags) {
    const manifestText = git(["show", `${tag}:package.json`], { allowFailure: true });
    if (!manifestText) continue;
    try {
      if (JSON.parse(manifestText).version !== candidateManifest.version) return tag;
    } catch {
      // Ignore malformed historical tags.
    }
  }

  throw new Error("Unable to resolve the previous WindStack release tag");
}

function runBuild(repositoryRoot) {
  const tscPath = path.join(root, "node_modules", "typescript", "bin", "tsc");
  const result = spawnSync(
    process.execPath,
    [tscPath, "-b", ...packageDirectories.map((directory) => `packages/${directory}`)],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Unable to build public declarations in ${repositoryRoot}`);
  }
}

function normalizeDeclaration(source) {
  return String(source)
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/gu, " "))
    .filter(Boolean);
}

function isSubsequence(previousLines, candidateLines) {
  let candidateIndex = 0;
  for (const previousLine of previousLines) {
    while (
      candidateIndex < candidateLines.length &&
      candidateLines[candidateIndex] !== previousLine
    ) {
      candidateIndex += 1;
    }
    if (candidateIndex >= candidateLines.length) return false;
    candidateIndex += 1;
  }
  return true;
}

function declarationCandidates(filePath, specifier) {
  const base = path.resolve(path.dirname(filePath), specifier);
  const candidates = [];

  if (/\.js$/u.test(base)) candidates.push(base.replace(/\.js$/u, ".d.ts"));
  if (/\.mjs$/u.test(base)) candidates.push(base.replace(/\.mjs$/u, ".d.mts"));
  if (/\.cjs$/u.test(base)) candidates.push(base.replace(/\.cjs$/u, ".d.cts"));
  if (/\.d\.(?:ts|mts|cts)$/u.test(base)) candidates.push(base);
  if (!path.extname(base)) {
    candidates.push(`${base}.d.ts`);
    candidates.push(path.join(base, "index.d.ts"));
  }

  return [...new Set(candidates)];
}

async function readableFile(candidates) {
  for (const filePath of candidates) {
    try {
      await readFile(filePath, "utf8");
      return filePath;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function collectDeclarationClosure(entryPath, packageRoot) {
  const seen = new Set();
  const files = new Map();
  const queue = [entryPath];

  while (queue.length) {
    const filePath = queue.shift();
    if (seen.has(filePath)) continue;
    seen.add(filePath);

    const source = await readFile(filePath, "utf8");
    const relativePath = path.relative(packageRoot, filePath).replaceAll(path.sep, "/");
    files.set(relativePath, normalizeDeclaration(source));

    const specifiers = new Set();
    const patterns = [
      /(?:export|import)\s+(?:type\s+)?(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/gu,
      /import\(["']([^"']+)["']\)/gu,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        if (match[1]?.startsWith(".")) specifiers.add(match[1]);
      }
    }

    for (const specifier of specifiers) {
      const dependency = await readableFile(declarationCandidates(filePath, specifier));
      if (!dependency) {
        throw new Error(
          `Unable to resolve public declaration dependency ${specifier} from ${filePath}`,
        );
      }
      queue.push(dependency);
    }
  }

  return files;
}

async function snapshotRepository(repositoryRoot) {
  const snapshot = {};

  for (const directory of packageDirectories) {
    const packageRoot = path.join(repositoryRoot, "packages", directory);
    const manifest = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));

    for (const [entry, conditions] of Object.entries(manifest.exports ?? {})) {
      const target =
        typeof conditions === "string"
          ? conditions
          : conditions && typeof conditions === "object"
            ? conditions.types
            : undefined;
      if (typeof target !== "string" || !target.endsWith(".d.ts")) continue;

      const entryPath = path.join(packageRoot, target);
      const key = `${manifest.name}::${entry}`;
      snapshot[key] = Object.fromEntries(
        [...(await collectDeclarationClosure(entryPath, packageRoot)).entries()].sort(
          ([left], [right]) => left.localeCompare(right),
        ),
      );
    }
  }

  return snapshot;
}

function compareSnapshots(previous, candidate) {
  const additions = [];
  const changes = [];
  const entryKeys = new Set([...Object.keys(previous), ...Object.keys(candidate)]);

  for (const key of [...entryKeys].sort()) {
    const [packageName, entry] = key.split("::");
    const before = previous[key];
    const after = candidate[key];

    if (!before) {
      additions.push({ kind: "entry-added", package: packageName, entry, file: "*" });
      continue;
    }
    if (!after) {
      changes.push({ kind: "entry-removed", package: packageName, entry, file: "*" });
      continue;
    }

    const files = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const file of [...files].sort()) {
      if (!(file in before)) {
        additions.push({ kind: "declaration-added", package: packageName, entry, file });
        continue;
      }
      if (!(file in after)) {
        changes.push({ kind: "declaration-removed", package: packageName, entry, file });
        continue;
      }

      const previousLines = before[file];
      const candidateLines = after[file];
      if (JSON.stringify(previousLines) === JSON.stringify(candidateLines)) continue;

      if (isSubsequence(previousLines, candidateLines)) {
        additions.push({
          kind: "declaration-additive-change",
          package: packageName,
          entry,
          file,
        });
        continue;
      }

      changes.push({
        kind: "declaration-changed",
        package: packageName,
        entry,
        file,
        previousLines,
        candidateLines,
      });
    }
  }

  return { additions, changes };
}

function approvalKey(value) {
  return [value.kind, value.package, value.entry, value.file].join("::");
}

const baseline = resolveApiBaseline();
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "windstack-api-baseline-"));
const baselineRoot = path.join(temporaryRoot, "baseline");
let worktreeAdded = false;

try {
  runBuild(root);

  const add = spawnSync("git", ["worktree", "add", "--detach", baselineRoot, baseline], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (add.status !== 0) {
    throw new Error(`Unable to create API baseline worktree for ${baseline}`);
  }
  worktreeAdded = true;

  await symlink(path.join(root, "node_modules"), path.join(baselineRoot, "node_modules"), "dir");
  runBuild(baselineRoot);

  const previous = await snapshotRepository(baselineRoot);
  const candidate = await snapshotRepository(root);
  const { additions, changes } = compareSnapshots(previous, candidate);

  const approvalsDocument = JSON.parse(
    await readFile(path.join(root, "specs", "api-compat-approvals.json"), "utf8"),
  );
  if (approvalsDocument.schemaVersion !== 1 || !Array.isArray(approvalsDocument.approvals)) {
    throw new Error("Invalid API compatibility approvals document");
  }

  const approvals = new Map(
    approvalsDocument.approvals.map((approval) => {
      if (
        typeof approval.kind !== "string" ||
        typeof approval.package !== "string" ||
        typeof approval.entry !== "string" ||
        typeof approval.file !== "string" ||
        typeof approval.reason !== "string" ||
        approval.reason.trim().length < 12
      ) {
        throw new Error("API compatibility approval is malformed or has no useful reason");
      }
      return [approvalKey(approval), approval];
    }),
  );

  const reviewedChanges = changes.map((change) => ({
    ...change,
    approval: approvals.get(approvalKey(change)) ?? null,
  }));
  const unapproved = reviewedChanges.filter(({ approval }) => !approval);

  const report = {
    schemaVersion: 1,
    baseline,
    candidateVersion: candidateManifest.version,
    gitSha: git(["rev-parse", "HEAD"]),
    additions,
    changes: reviewedChanges,
    unapprovedBreakingChanges: unapproved.length,
  };

  await mkdir(releaseRoot, { recursive: true });
  await writeFile(
    path.join(releaseRoot, "api-compat-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log(
    `API compatibility: ${additions.length} additive changes, ${changes.length} reviewed changes, ${unapproved.length} unapproved.`,
  );
  for (const change of unapproved) {
    console.error(
      `- ${change.kind}: ${change.package} ${change.entry} :: ${change.file}`,
    );
  }

  if (unapproved.length) {
    throw new Error(
      "Public declaration changes require explicit entries in specs/api-compat-approvals.json",
    );
  }
} finally {
  if (worktreeAdded) {
    spawnSync("git", ["worktree", "remove", "--force", baselineRoot], {
      cwd: root,
      encoding: "utf8",
      stdio: "ignore",
    });
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}
