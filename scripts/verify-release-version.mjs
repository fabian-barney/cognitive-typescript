import { readFile } from "node:fs/promises";
import path from "node:path";

const tagRef = process.env.GITHUB_REF_NAME ?? process.argv[2];
if (!tagRef) {
  throw new Error("A tag name is required.");
}

const expectedVersion = tagRef.startsWith("v") ? tagRef.slice(1) : tagRef;
const readJson = async (relativePath) => JSON.parse(await readFile(path.resolve(relativePath), "utf8"));
const packageFiles = [
  "packages/core/package.json",
  "packages/cli/package.json",
  "packages/vitest/package.json",
  "packages/jest/package.json"
];
const corePackageName = "@barney-media/cognitive-typescript-core";
const rootPackage = await readJson("package.json");
const lockfile = await readJson("package-lock.json");
const packageEntries = await Promise.all(
  packageFiles.map(async (packageFile) => ({
    file: packageFile,
    parsed: await readJson(packageFile)
  }))
);

function assertVersion(label, actualVersion) {
  if (actualVersion !== expectedVersion) {
    throw new Error(`${label} has version ${actualVersion}, expected ${expectedVersion}`);
  }
}

assertVersion("package.json", rootPackage.version);
assertVersion("package-lock.json", lockfile.version);
assertVersion('package-lock.json packages[""]', lockfile.packages?.[""]?.version);

for (const { file, parsed } of packageEntries) {
  assertVersion(file, parsed.version);

  const lockPath = file.replaceAll("\\", "/").replace(/\/package\.json$/, "");
  const lockPackage = lockfile.packages?.[lockPath];
  assertVersion(`package-lock.json ${lockPath}`, lockPackage?.version);

  if (parsed.name === corePackageName) {
    continue;
  }

  const expectedCoreRange = `^${expectedVersion}`;
  const packageCoreRange = parsed.dependencies?.[corePackageName];
  if (packageCoreRange !== expectedCoreRange) {
    throw new Error(`${file} has ${corePackageName} ${packageCoreRange}, expected ${expectedCoreRange}`);
  }

  const lockCoreRange = lockPackage?.dependencies?.[corePackageName];
  if (lockCoreRange !== expectedCoreRange) {
    throw new Error(`package-lock.json ${lockPath} has ${corePackageName} ${lockCoreRange}, expected ${expectedCoreRange}`);
  }
}
