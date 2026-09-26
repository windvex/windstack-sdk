import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  WISP_TELEGRAM_HANDOFF_EVENTS_PATH,
  WISP_TELEGRAM_HANDOFF_EVENT_RETRY_MS,
  WISP_TELEGRAM_HANDOFF_KINDS,
  WISP_TELEGRAM_HANDOFF_PREPARE_PATH,
  WISP_TELEGRAM_HANDOFF_STATUSES,
  parseWispTelegramHandoffStatus,
  parseWispTelegramPreparedHandoff,
} from "../packages/wallet-plugin-wisp/dist/index.js";

const spec = JSON.parse(
  await readFile(new URL("../specs/wisp-telegram-handoff.json", import.meta.url), "utf8"),
);

assert.equal(spec.schemaVersion, 1);
assert.equal(spec.transport.preparePath, WISP_TELEGRAM_HANDOFF_PREPARE_PATH);
assert.equal(spec.transport.eventsPath, WISP_TELEGRAM_HANDOFF_EVENTS_PATH);
assert.equal(spec.transport.eventSource.retryMs, WISP_TELEGRAM_HANDOFF_EVENT_RETRY_MS);
assert.equal(spec.transport.eventSource.pollingFallback, false);
assert.deepEqual(spec.request.kinds, [...WISP_TELEGRAM_HANDOFF_KINDS]);
assert.deepEqual(spec.status.values, [...WISP_TELEGRAM_HANDOFF_STATUSES]);

const pending = parseWispTelegramPreparedHandoff({
  id: "handoff-1",
  eventId: 1,
  status: "pending",
  expiresAt: Date.now() + 60_000,
  startParam: "dapp_handoff-1",
  launchUrl: "https://t.me/wispwalletbot?startapp=dapp_handoff-1",
});
assert.equal(pending.status, "pending");

const approved = parseWispTelegramHandoffStatus(
  {
    id: "handoff-1",
    eventId: 3,
    status: "approved",
    expiresAt: Date.now() + 60_000,
    result: {
      actor: "gvexa",
      permission: "active",
      sessionId: "wisp_session-1",
      chainId: "f9f432b1851b5c179d2091a96f593aaed50ec7466b74f89301f957a83e56ce1f",
      sessionExpiresAt: Date.now() + 86_400_000,
    },
  },
  "handoff-1",
);
assert.equal(approved.status, "approved");

assert.throws(() =>
  parseWispTelegramHandoffStatus({
    id: "handoff-1",
    eventId: 3,
    status: "approved",
    expiresAt: Date.now() + 60_000,
    result: {
      actor: "gvexa",
      permission: "active",
      sessionInvalidated: true,
    },
  }),
);

assert.throws(() =>
  parseWispTelegramHandoffStatus(
    {
      id: "handoff-2",
      eventId: 3,
      status: "failed",
      expiresAt: Date.now() + 60_000,
      result: {
        sessionInvalidated: true,
        error: "Wallet session is no longer active.",
      },
    },
    "handoff-1",
  ),
);

console.log("Wisp Telegram handoff protocol: PASS");
