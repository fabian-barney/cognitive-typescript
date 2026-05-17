import { realpath, stat } from "node:fs/promises";
import path from "node:path";

export interface ReportPathTarget {
  label: string;
  path: string | undefined;
}

interface ResolvedReportPathTarget {
  label: string;
  path: string;
  absolutePath: string;
  collisionPath: string;
}

type FilesystemCaseCache = Map<string, boolean>;

export async function validateReportPathTargets(
  projectRoot: string,
  targets: ReportPathTarget[]
): Promise<void> {
  const root = path.resolve(projectRoot);
  const reportTargets = targets.filter((target): target is { label: string; path: string } => (
    target.path !== undefined
  ));
  const shouldCheckCaseCollisions = reportTargets.length > 1;
  const filesystemCaseCache: FilesystemCaseCache = new Map();
  const resolvedTargets = await Promise.all(
    reportTargets.map((target) => (
      resolveReportPathTarget(root, target, shouldCheckCaseCollisions, filesystemCaseCache)
    ))
  );

  for (let leftIndex = 0; leftIndex < resolvedTargets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < resolvedTargets.length; rightIndex += 1) {
      ensureDistinctReportPaths(resolvedTargets[leftIndex], resolvedTargets[rightIndex]);
    }
  }
}

async function resolveReportPathTarget(
  projectRoot: string,
  target: { label: string; path: string },
  shouldCheckCaseCollisions: boolean,
  filesystemCaseCache: FilesystemCaseCache
): Promise<ResolvedReportPathTarget> {
  const absolutePath = path.resolve(projectRoot, target.path);
  assertReportTargetPath(projectRoot, absolutePath, target.label);
  assertInsideProjectRoot(projectRoot, absolutePath, target.label);
  await assertTargetIsNotDirectory(absolutePath, target.label);
  const canonicalPath = await canonicalizeReportPath(absolutePath);
  await assertCanonicalPathInsideProjectRoot(projectRoot, canonicalPath, target.label);
  const caseInsensitiveFilesystem = await collisionCaseSensitivity(
    shouldCheckCaseCollisions,
    absolutePath,
    filesystemCaseCache
  );

  return {
    label: target.label,
    path: target.path,
    absolutePath,
    collisionPath: normalizeReportPathForCollision(canonicalPath, caseInsensitiveFilesystem)
  };
}

function assertReportTargetPath(projectRoot: string, absolutePath: string, label: string): void {
  if (isFilesystemRoot(absolutePath)) {
    throw new Error(`${label} must target a report file, not a filesystem root`);
  }
  if (absolutePath === projectRoot) {
    throw new Error(`${label} must target a report file, not the project root`);
  }
}

async function assertTargetIsNotDirectory(absolutePath: string, label: string): Promise<void> {
  const stats = await statIfExists(absolutePath);
  if (stats?.isDirectory()) {
    throw new Error(`${label} must target a report file, not an existing directory`);
  }
}

async function assertCanonicalPathInsideProjectRoot(
  projectRoot: string,
  canonicalPath: string,
  label: string
): Promise<void> {
  const canonicalRoot = await canonicalizeExistingParent(projectRoot);
  if (!isInsidePath(canonicalRoot, canonicalPath)) {
    throw new Error(`${label} must stay inside the project root`);
  }
}

async function collisionCaseSensitivity(
  shouldCheckCaseCollisions: boolean,
  absolutePath: string,
  filesystemCaseCache: FilesystemCaseCache
): Promise<boolean> {
  if (!shouldCheckCaseCollisions) {
    return false;
  }
  return caseInsensitiveFilesystemForTarget(absolutePath, filesystemCaseCache);
}

async function caseInsensitiveFilesystemForTarget(
  absolutePath: string,
  filesystemCaseCache: FilesystemCaseCache
): Promise<boolean> {
  const parent = await nearestExistingParent(path.dirname(absolutePath));
  const cached = filesystemCaseCache.get(parent);
  if (cached !== undefined) {
    return cached;
  }
  const caseInsensitiveFilesystem = defaultCaseInsensitiveFilesystem();
  filesystemCaseCache.set(parent, caseInsensitiveFilesystem);
  return caseInsensitiveFilesystem;
}

export function assertInsideProjectRoot(projectRoot: string, candidatePath: string, label: string): void {
  if (!isInsidePath(projectRoot, candidatePath)) {
    throw new Error(`${label} must stay inside the project root`);
  }
}

async function statIfExists(filePath: string): Promise<Awaited<ReturnType<typeof stat>> | undefined> {
  try {
    return await stat(filePath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return undefined;
    }
    throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

async function canonicalizeReportPath(filePath: string): Promise<string> {
  try {
    return await realpath(filePath);
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    return path.join(await canonicalizeExistingParent(path.dirname(filePath)), path.basename(filePath));
  }
}

async function canonicalizeExistingParent(directoryPath: string): Promise<string> {
  const resolved = await resolveCanonicalParent(directoryPath);
  return resolved.missingSegments.reduce(
    (currentPath, segment) => path.join(currentPath, segment),
    resolved.canonicalPath
  );
}

interface CanonicalParentResolution {
  canonicalPath: string;
  missingSegments: string[];
}

async function resolveCanonicalParent(directoryPath: string): Promise<CanonicalParentResolution> {
  try {
    return {
      canonicalPath: await realpath(directoryPath),
      missingSegments: []
    };
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
    return resolveMissingCanonicalParent(directoryPath);
  }
}

async function resolveMissingCanonicalParent(directoryPath: string): Promise<CanonicalParentResolution> {
  const parent = path.dirname(directoryPath);
  if (parent === directoryPath) {
    return {
      canonicalPath: directoryPath,
      missingSegments: []
    };
  }
  const resolvedParent = await resolveCanonicalParent(parent);
  return {
    canonicalPath: resolvedParent.canonicalPath,
    missingSegments: [...resolvedParent.missingSegments, path.basename(directoryPath)]
  };
}

async function nearestExistingParent(directoryPath: string): Promise<string> {
  const stats = await statIfExists(directoryPath);
  if (stats?.isDirectory()) {
    return realpath(directoryPath);
  }
  const parent = path.dirname(directoryPath);
  if (parent === directoryPath) {
    return directoryPath;
  }
  return nearestExistingParent(parent);
}

function normalizeReportPathForCollision(filePath: string, caseInsensitiveFilesystem: boolean): string {
  const normalized = path.normalize(filePath);
  return caseInsensitiveFilesystem ? normalized.toLowerCase() : normalized;
}

function defaultCaseInsensitiveFilesystem(): boolean {
  return process.platform === "win32" || process.platform === "darwin";
}

function isFilesystemRoot(filePath: string): boolean {
  const parsed = path.parse(filePath);
  return path.resolve(filePath) === parsed.root;
}

function isInsidePath(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function ensureDistinctReportPaths(left: ResolvedReportPathTarget, right: ResolvedReportPathTarget): void {
  if (left.collisionPath !== right.collisionPath) {
    return;
  }
  throw new Error(
    `${left.label} and ${right.label} must target different report files: ${left.path} and ${right.path}`
  );
}
