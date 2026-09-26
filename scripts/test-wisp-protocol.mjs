import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  WISP_BROWSER_NAVIGATION_MESSAGE,
  WISP_BROWSER_NAVIGATION_VERSION,
  WISP_LAUNCH_DEFAULT_URL,
  WISP_LAUNCH_HOSTS,
  WISP_SIGNING_REQUEST_SCHEMES,
  buildWispBrowserLaunchUrl,
  buildWispSigningRequestLaunchUrl,
  createWispBrowserNavigationMessage,
  createWispEip6963ProviderInfo,
  isWispLaunchRequestExpired,
  parseWispBrowserNavigationMessage,
  parseWispWalletLaunchUrl,
  resolveWispEmbeddedParentOrigin,
} from "../packages/wallet-plugin-wisp/dist/index.js";

const browserSpec = JSON.parse(
  await readFile(new URL("../specs/wisp-browser-navigation.json", import.meta.url), "utf8"),
);
const launchSpec = JSON.parse(
  await readFile(new URL("../specs/wisp-launch-contract.json", import.meta.url), "utf8"),
);

assert.equal(browserSpec.schemaVersion, 1);
assert.equal(browserSpec.message.type, WISP_BROWSER_NAVIGATION_MESSAGE);
assert.equal(browserSpec.message.version, WISP_BROWSER_NAVIGATION_VERSION);
assert.deepEqual(browserSpec.message.dispositions, ["browser", "external"]);
assert.equal(browserSpec.security.wildcardTargetOrigin, false);
assert.equal(browserSpec.security.productAllowlist, false);

const navigation = createWispBrowserNavigationMessage("https://example.com/swap", "external");
assert.equal(navigation.type, WISP_BROWSER_NAVIGATION_MESSAGE);
assert.equal(navigation.url, "https://example.com/swap");
assert.deepEqual(parseWispBrowserNavigationMessage(navigation), navigation);
assert.equal(
  parseWispBrowserNavigationMessage({
    ...navigation,
    url: "http://example.com/",
  }),
  null,
);

assert.equal(
  resolveWispEmbeddedParentOrigin(
    "https://tg.windcrypto.com",
    "https://tg.windcrypto.com/dapp/browser",
  ),
  "https://tg.windcrypto.com",
);
assert.equal(
  resolveWispEmbeddedParentOrigin("https://tg.windcrypto.com", ""),
  "https://tg.windcrypto.com",
);
assert.throws(() =>
  resolveWispEmbeddedParentOrigin(
    "https://tg.windcrypto.com",
    "https://example.com/embedded",
  ),
);

assert.equal(launchSpec.schemaVersion, 1);
assert.equal(launchSpec.link.defaultUrl, WISP_LAUNCH_DEFAULT_URL);
assert.deepEqual(launchSpec.link.hosts, [...WISP_LAUNCH_HOSTS]);
assert.deepEqual(launchSpec.signingRequest.schemes, [...WISP_SIGNING_REQUEST_SCHEMES]);
assert.equal(launchSpec.signingRequest.canonicalVexaniumScheme, "vsr");

const browserLaunch = buildWispBrowserLaunchUrl({
  url: "https://example.com/app",
  appName: "Example",
  chainId: "vexNative",
  expiresAt: 2_000_000_000,
});
const parsedBrowserLaunch = parseWispWalletLaunchUrl(browserLaunch);
assert.equal(parsedBrowserLaunch?.kind, "browser");
assert.equal(parsedBrowserLaunch?.url, "https://example.com/app");
assert.equal(parsedBrowserLaunch?.origin, "https://example.com");
assert.equal(parsedBrowserLaunch?.expiresAt, 2_000_000_000_000);
assert.equal(isWispLaunchRequestExpired(parsedBrowserLaunch, 1_900_000_000_000), false);
assert.equal(isWispLaunchRequestExpired(parsedBrowserLaunch, 2_000_000_000_000), true);

const vsrLaunch = buildWispSigningRequestLaunchUrl({
  payload: "vsr:example",
  requestId: "request-1",
});
const parsedVsrLaunch = parseWispWalletLaunchUrl(vsrLaunch);
assert.equal(parsedVsrLaunch?.kind, "signing-request");
assert.equal(parsedVsrLaunch?.scheme, "vsr");

const parsedEsrLaunch = parseWispWalletLaunchUrl("esr:example");
assert.equal(parsedEsrLaunch?.kind, "signing-request");
assert.equal(parsedEsrLaunch?.scheme, "esr");

assert.equal(
  parseWispWalletLaunchUrl("wispwallet://dapp?url=https%3A%2F%2Fexample.com", {
    walletSchemes: ["wispwallet"],
  })?.kind,
  "browser",
);
assert.equal(
  parseWispWalletLaunchUrl("wispwallet://dapp?url=https%3A%2F%2Fexample.com"),
  null,
);

assert.throws(() =>
  buildWispBrowserLaunchUrl({
    url: "https://example.com/app",
    origin: "https://other.example",
  }),
);

const generatedInfo = createWispEip6963ProviderInfo({
  icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
});
assert.match(
  generatedInfo.uuid,
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
);

console.log("Wisp browser, embedded-origin, and launch protocols: PASS");
