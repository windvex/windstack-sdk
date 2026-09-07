/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packages = [
  "crypto",
  "abi",
  "rpc",
  "contract",
  "account",
  "antelope",
  "signing-request",
  "session",
];
const directory = await mkdtemp(path.join(tmpdir(), "windstack-native-audit-"));

try {
  await writeFile(
    path.join(directory, "package.json"),
    `${JSON.stringify(
      {
        name: "windstack-native-audit",
        version: "1.0.0",
        private: true,
        workspaces: ["packages/*"],
      },
      null,
      2,
    )}\n`,
  );

  for (const name of packages) {
    const target = path.join(directory, "packages", name);
    await mkdir(target, { recursive: true });
    await copyFile(
      path.join(root, "packages", name, "package.json"),
      path.join(target, "package.json"),
    );
  }

  for (const args of [
    ["install", "--ignore-scripts", "--no-fund", "--no-audit"],
    ["ls", "--all"],
    ["audit", "--omit=dev"],
  ]) {
    const result = spawnSync("npm", args, {
      cwd: directory,
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`Native dependency audit failed during npm ${args[0]}`);
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}

console.log("Native production dependency audit passed");
