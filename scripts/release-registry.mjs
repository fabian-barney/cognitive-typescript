import { jsonRequest, npmPackageUrl } from "./release-lib.mjs";
import { digest } from "./release-artifacts.mjs";

const temporaryNetworkCodes = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET"
]);

function temporaryRegistryFailure(error) {
  return (
    error.status === 429 ||
    (error.status >= 500 && error.status <= 599) ||
    error.name === "TimeoutError" ||
    (error instanceof TypeError && temporaryNetworkCodes.has(error.cause?.code))
  );
}

function integrityMatches(metadata, expected, packageName, representation = "") {
  const integrity = metadata?.dist?.integrity;
  if (integrity == null) return false;
  if (integrity !== expected) throw new Error(`npm ${representation}integrity mismatch: ${packageName}`);
  return true;
}

async function hasPublishedProvenance(metadata, request) {
  const url = metadata.dist.attestations?.url;
  if (!url) return false;
  const provenance = await request(url, { allowMissing: true });
  return provenance?.attestations?.some((entry) => entry.predicateType === "https://slsa.dev/provenance/v1") ?? false;
}

async function metadataReady(pkg, packageUrl, expected, request) {
  const metadata = await request(`${packageUrl}/${pkg.version}`, { allowMissing: true });
  if (!integrityMatches(metadata, expected, pkg.name)) return false;
  if (!(await hasPublishedProvenance(metadata, request))) return false;
  const installMetadata = await request(packageUrl, {
    allowMissing: true,
    headers: { Accept: "application/vnd.npm.install-v1+json", "Cache-Control": "no-cache" }
  });
  if (!integrityMatches(installMetadata?.versions?.[pkg.version], expected, pkg.name, "install ")) return false;
  return installMetadata["dist-tags"]?.latest === pkg.version;
}

export async function verifyPublishedPackage(
  pkg,
  bytes,
  { request = jsonRequest, attempts = 60, pause = () => new Promise((resolve) => setTimeout(resolve, 10000)) } = {}
) {
  const expected = `sha512-${digest(bytes, "sha512", "base64")}`;
  // Match npm's canonical scoped-package URL and its separate install-metadata representation.
  const packageUrl = npmPackageUrl(pkg.name);
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      if (await metadataReady(pkg, packageUrl, expected, request)) return;
    } catch (error) {
      if (!temporaryRegistryFailure(error)) throw error;
    }
    if (attempt + 1 < attempts) await pause();
  }
  throw new Error(`Timed out waiting for npm metadata and provenance: ${pkg.name}@${pkg.version}`);
}
