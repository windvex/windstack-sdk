/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import * as ts from "typescript";
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

const baseline = resolveApiBaseline();

const formatFlags =
  ts.TypeFormatFlags.NoTruncation |
  ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope |
  ts.TypeFormatFlags.WriteTypeArgumentsOfSignature;

function normalizeText(value) {
  return String(value).replace(/\s+/gu, " ").trim();
}

async function walk(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full, suffix)));
    else if (entry.name.endsWith(suffix)) files.push(full);
  }
  return files;
}

async function publicEntries(repositoryRoot) {
  const entries = [];
  for (const directory of packageDirectories) {
    const manifest = JSON.parse(
      await readFile(path.join(repositoryRoot, "packages", directory, "package.json"), "utf8"),
    );
    for (const [entry, conditions] of Object.entries(manifest.exports ?? {})) {
      const target =
        typeof conditions === "string"
          ? conditions
          : conditions && typeof conditions === "object"
            ? conditions.types
            : undefined;
      if (typeof target !== "string" || !target.endsWith(".d.ts")) continue;
      entries.push({
        packageName: manifest.name,
        entry,
        declarationPath: path.join(repositoryRoot, "packages", directory, target),
      });
    }
  }
  return entries;
}

function compilerOptions(repositoryRoot) {
  const paths = Object.fromEntries(
    packageDirectories.map((directory) => [
      `@windstack/${directory}`,
      [`./packages/${directory}/dist/index.d.ts`],
    ]),
  );
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    strict: true,
    baseUrl: repositoryRoot,
    paths,
  };
}

function snapshotSymbol(checker, symbol) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declarations = target.declarations ?? symbol.declarations ?? [];
  const location = target.valueDeclaration ?? declarations[0];
  const declarationKinds = [
    ...new Set(declarations.map((declaration) => ts.SyntaxKind[declaration.kind])),
  ].sort();

  let valueType = null;
  let declaredType = null;
  let callSignatures = [];
  let constructSignatures = [];

  if (location && target.flags & ts.SymbolFlags.Value) {
    const type = checker.getTypeOfSymbolAtLocation(target, location);
    valueType = normalizeText(checker.typeToString(type, location, formatFlags));
    callSignatures = checker
      .getSignaturesOfType(type, ts.SignatureKind.Call)
      .map((signature) =>
        normalizeText(checker.signatureToString(signature, location, formatFlags)),
      )
      .sort();
    constructSignatures = checker
      .getSignaturesOfType(type, ts.SignatureKind.Construct)
      .map((signature) => normalizeText(checker.signatureToString(signature, location, formatFlags)))
      .sort();
  }

  if (location && target.flags & ts.SymbolFlags.Type) {
    try {
      declaredType = normalizeText(
        checker.typeToString(checker.getDeclaredTypeOfSymbol(target), location, formatFlags),
      );
    } catch {
      declaredType = null;
    }
  }

  return {
    declarationKinds,
    declarations: declarations.map((declaration) => normalizeText(declaration.getText())).sort(),
    valueType,
    declaredType,
    callSignatures,
    constructSignatures,
  };
}

async function snapshotRepository(repositoryRoot) {
  const declarationFiles = [];
  for (const directory of packageDirectories) {
    declarationFiles.push(
      ...(await walk(path.join(repositoryRoot, "packages", directory, "dist"), ".d.ts")),
    );
  }
  const program = ts.createProgram({
    rootNames: declarationFiles,
    options: compilerOptions(repositoryRoot),
  });
  const checker = program.getTypeChecker();
  const result = {};

  for (const entry of await publicEntries(repositoryRoot)) {
    const source = program.getSourceFile(entry.declarationPath);
    if (!source) {
      throw new Error(
        `Unable to load declaration entry ${entry.packageName}${
          entry.entry === "." ? "" : entry.entry
        }`,
      );
    }
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (!moduleSymbol) throw new Error(`No module symbol for ${entry.declarationPath}`);

    const key = `${entry.packageName}::${entry.entry}`;
    result[key] = Object.fromEntries(
      checker
        .getExportsOfModule(moduleSymbol)
        .map((symbol) => [symbol.getName(), snapshotSymbol(checker, symbol)])
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  }

  return result;
}

function compareSnapshots(previous, candidate) {
  const added = [];
  const changes = [];
  const entryKeys = new Set([...Object.keys(previous), ...Object.keys(candidate)]);

  for (const key of [...entryKeys].sort()) {
    const [packageName, entry] = key.split("::");
    const before = previous[key];
    const after = candidate[key];

    if (!before) {
      added.push({ kind: "entry-added", package: packageName, entry });
      continue;
    }
    if (!after) {
      changes.push({ kind: "entry-removed", package: packageName, entry, export: "*" });
      continue;
    }

    const names = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const name of [...names].sort()) {
      if (!(name in before)) {
        added.push({ kind: "export-added", package: packageName, entry, export: name });
        continue;
      }
      if (!(name in after)) {
        changes.push({ kind: "export-removed", package: packageName, entry, export: name });
        continue;
      }
      if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) {
        changes.push({
          kind: "export-changed",
          package: packageName,
          entry,
          export: name,
          before: before[name],
          after: after[name],
        });
      }
    }
  }

  return { added, changes };
}

function approvalKey(value) {
  return [value.kind, value.package, value.entry, value.export ?? "*"].join("::");
}

const tscPath = path.join(root, "node_modules", "typescript", "bin", "tsc");
const candidateBuild = spawnSync(
  process.execPath,
  [tscPath, "-b", ...packageDirectories.map((directory) => `packages/${directory}`)],
  {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  },
);
if (candidateBuild.status !== 0) {
  throw new Error("Unable to build candidate public declarations");
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), "windstack-api-baseline-"));
const baselineRoot = path.join(temporaryRoot, "baseline");
let worktreeAdded = false;

try {
  const add = spawnSync("git", ["worktree", "add", "--detach", baselineRoot, baseline], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (add.status !== 0) throw new Error(`Unable to create API baseline worktree for ${baseline}`);
  worktreeAdded = true;

  await symlink(path.join(root, "node_modules"), path.join(baselineRoot, "node_modules"), "dir");

  const build = spawnSync(
    process.execPath,
    [tscPath, "-b", ...packageDirectories.map((directory) => `packages/${directory}`)],
    {
      cwd: baselineRoot,
      encoding: "utf8",
      stdio: "inherit",
    },
  );
  if (build.status !== 0) throw new Error(`Unable to build API baseline ${baseline}`);

  const previous = await snapshotRepository(baselineRoot);
  const candidate = await snapshotRepository(root);
  const { added, changes } = compareSnapshots(previous, candidate);

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
        typeof approval.export !== "string" ||
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
    added,
    changes: reviewedChanges,
    unapprovedBreakingChanges: unapproved.length,
  };

  await mkdir(releaseRoot, { recursive: true });
  await writeFile(
    path.join(releaseRoot, "api-compat-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  console.log(
    `API compatibility: ${added.length} additions, ${changes.length} reviewed changes, ${unapproved.length} unapproved.`,

  );
  for (const change of unapproved) {
    console.error(
      `- ${change.kind}: ${change.package} ${change.entry} :: ${change.export ?? "*"}`,
    );
  }
  if (unapproved.length) {
    throw new Error(
      "Public API changes require explicit entries in specs/api-compat-approvals.json",
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
