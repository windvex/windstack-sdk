/**
 * WindStack SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  currentCandidatePointer,
  git,
  loadReleaseEntries,
  releaseRoot,
  root,
  sha256File,
  tarballFilename,
} from "./release-artifacts.mjs";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

const branch = git(["branch", "--show-current"]);
if (branch !== "main") {
  throw new Error(`Candidate creation requires main, not ${branch || "detached"}`);
}
if (git(["status", "--porcelain"])) {
  throw new Error("Candidate creation requires a clean working tree");
}

const head = git(["rev-parse", "HEAD"]);
const remoteHead = git(["rev-parse", "origin/main"], { allowFailure: true });
if (remoteHead && head !== remoteHead) {
  throw new Error("Candidate creation requires local main to match origin/main");
}

const { rootManifest, entries } = await loadReleaseEntries();
const apiReportPath = path.join(releaseRoot, "api-compat-report.json");
await access(apiReportPath);
const apiReport = JSON.parse(await readFile(apiReportPath, "utf8"));
if (apiReport.gitSha !== head || apiReport.candidateVersion !== rootManifest.version) {
  throw new Error("API report does not match the current candidate HEAD/version");
}
if (apiReport.unapprovedBreakingChanges !== 0) {
  throw new Error("API report contains unapproved public API changes");
}

const candidateId = `${rootManifest.version}-${head}`;
const candidateDirectory = path.join(releaseRoot, "candidates", candidateId);
const manifestPath = path.join(candidateDirectory, "manifest.json");

try {
  await access(manifestPath);
  throw new Error(
    `Candidate ${candidateId} already exists. Refusing to repack immutable artifacts.`,
  );
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

await mkdir(path.dirname(candidateDirectory), { recursive: true });
const stagingDirectory = await mkdtemp(path.join(releaseRoot, "candidate-staging-"));

try {
  const packages = [];
  for (const { manifest } of entries) {
    run("npm", [
      "pack",
      "--workspace",
      manifest.name,
      "--pack-destination",
      stagingDirectory,
    ]);
    const filename = tarballFilename(manifest.name, manifest.version);
    const filePath = path.join(stagingDirectory, filename);
    await access(filePath);
    packages.push({
      name: manifest.name,
      version: manifest.version,
      filename,
      sha256: await sha256File(filePath),
    });
  }

  const manifest = {
    schemaVersion: 1,
    version: rootManifest.version,
    gitSha: head,
    apiBaseline: apiReport.baseline,
    apiReportSha256: await sha256File(apiReportPath),
    packages,
  };
  await writeFile(
    path.join(stagingDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  await rename(stagingDirectory, candidateDirectory);
  await writeFile(
    currentCandidatePointer,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        manifest: path.relative(releaseRoot, manifestPath).replaceAll(path.sep, "/"),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`Immutable WindStack candidate created: ${candidateId}`);
  for (const entry of packages) console.log(`- ${entry.filename}  ${entry.sha256}`);
} catch (error) {
  await rm(stagingDirectory, { recursive: true, force: true });
  throw error;
}
