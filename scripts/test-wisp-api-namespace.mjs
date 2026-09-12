import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readme = await readFile("packages/wallet-plugin-wisp/README.md", "utf8");

assert.match(
  readme,
  /apiUrl: "https:\/\/api\.windcrypto\.com\/wisp\/v1"/u,
  "Wisp Telegram documentation must use the dedicated /wisp/v1 API namespace",
);
assert.doesNotMatch(
  readme,
  /apiUrl: "https:\/\/api\.windcrypto\.com"(?:\s|,)/u,
  "Wisp Telegram documentation must not target the shared API domain root",
);
assert.match(
  readme,
  /does not use the shared domain's root `\/telegram\/\*`, `\/rpc`, `\/v1\/\*`, or `\/v3\/\*` routes/u,
  "Wisp Telegram documentation must preserve shared-domain route ownership",
);

console.log("PASS: Wisp Telegram public API examples stay inside /wisp/v1");
