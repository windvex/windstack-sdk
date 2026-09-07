import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDirectories = ["crypto", "abi", "rpc", "contract", "account", "antelope", "session"];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
  return result;
}

function requireCleanMain() {
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  if (branch !== "main") throw new Error(`Release must run from main; current branch is ${branch || "detached"}`);
  const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
  if (status) throw new Error("Release requires a clean working tree");
}

function publishedVersion(name, version) {
  const result = run("npm", ["view", `${name}@${version}`, "version", "--json"], {
    capture: true,
    allowFailure: true,
  });
  if (result.status === 0) {
    const parsed = JSON.parse(result.stdout || "null");
    return parsed === version;
  }
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (/E404|404 Not Found|No match found for version/i.test(output)) return false;
  throw new Error(`Unable to query npm for ${name}@${version}: ${output.trim()}`);
}

requireCleanMain();
run("npm", ["whoami"]);
run("npm", ["run", "release:dry-run"]);

for (const directory of packageDirectories) {
  const manifest = JSON.parse(await readFile(path.join(root, "packages", directory, "package.json"), "utf8"));
  const { name, version } = manifest;
  if (publishedVersion(name, version)) {
    console.log(`${name}@${version} is already published; skipping.`);
    continue;
  }

  console.log(`Publishing ${name}@${version}...`);
  run("npm", ["publish", "--workspace", name, "--access", "public"]);

  let verified = false;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (publishedVersion(name, version)) {
      verified = true;
      break;
    }
    await sleep(1500);
  }
  if (!verified) throw new Error(`npm did not confirm ${name}@${version} after publish`);
}

console.log("All WindStack native packages are published and verified.");
