import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const targets = process.argv.slice(2);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const cliEntryPoint = join(repositoryRoot, "packages", "cli", "dist", "bin.js");

if (targets.length === 0) {
  console.error("Usage: node ./scripts/run-cognitive-typescript-gate.mjs <path...>");
  process.exit(1);
}

if (!existsSync(cliEntryPoint)) {
  console.error("Missing built CLI at packages/cli/dist/bin.js. Run `npm run build` before the gate.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [cliEntryPoint, ...targets.map((target) => resolve(repositoryRoot, target))],
  {
    cwd: repositoryRoot,
    stdio: "inherit"
  }
);

if (result.error) {
  console.error(result.error.message);
}

process.exitCode = result.status ?? 1;
