/**
 * WindStack Antelope SDK
 * Created by Gilang Ramadan
 * Copyright (c) 2026 PT WIND KRIPTOGRAFI TEKNOLOGI
 * SPDX-License-Identifier: MIT
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtureDirectory = path.join(root, "test", "fixtures", "vexanium");
const endpoint = "https://api.windcrypto.com";

await mkdir(fixtureDirectory, { recursive: true });
for (const account of ["vex.token", "vexcore"]) {
  const response = await fetch(`${endpoint}/v1/chain/get_abi`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ account_name: account }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Unable to fetch ${account} ABI: HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.abi || typeof payload.abi !== "object") {
    throw new TypeError(`Vexanium RPC returned no ABI for ${account}`);
  }
  await writeFile(
    path.join(fixtureDirectory, `${account}.abi.json`),
    `${JSON.stringify(payload.abi, null, 2)}\n`,
    "utf8",
  );
}

console.log("Updated Vexanium production ABI fixtures");
