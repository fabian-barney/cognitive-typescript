import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_EXCLUDED_SOURCE_ROOT_DISCOVERY_DIRECTORIES, IGNORED_DIRECTORIES } from "./constants";
import { runCommand, toRelativePath } from "./utils";

const SOURCE_FILE_SUFFIXES = [".ts", ".tsx", ".mts", ".cts"];
const DECLARATION_FILE_SUFFIXES = [".d.ts", ".d.mts", ".d.cts"];
const GIT_STATUS_TIMEOUT_MS = 30_000;
const MAX_CAPTURED_GIT_OUTPUT_BYTES = 64 * 1024;
const GIT_STATUS_COMMAND_DESCRIPTION = "git status --porcelain=v1 -z --untracked-files=all";

interface FileSelectionOptions {
  pruneDefaultExcludedDirectories?: boolean;
}

type CommandRunner = typeof runCommand;

export async function findAllTypeScriptFilesUnderSourceRoots(
  projectRoot: string,
  options: FileSelectionOptions = {}
): Promise<string[]> {
  const files = new Set<string>();
  await walkForSourceRoots(projectRoot, async (sourceRoot) => {
    await walkSourceTree(sourceRoot, async (filePath) => {
      files.add(path.resolve(filePath));
    });
  }, options);
  return Array.from(files).sort();
}

export async function expandExplicitPaths(
  projectRoot: string,
  values: string[],
  options: FileSelectionOptions = {}
): Promise<string[]> {
  const files = new Set<string>();
  for (const value of values) {
    const resolvedPath = path.resolve(projectRoot, value);
    const fileStats = await lstat(resolvedPath);
    if (fileStats.isSymbolicLink()) {
      continue;
    }
    if (fileStats.isDirectory()) {
      await expandDirectoryPath(resolvedPath, files, options);
      continue;
    }
    if (isAnalyzableFile(resolvedPath)) {
      files.add(resolvedPath);
    }
  }
  return Array.from(files).sort();
}

export async function changedTypeScriptFilesUnderSourceRoots(
  projectRoot: string,
  commandRunner: CommandRunner = runCommand
): Promise<string[]> {
  const entries = await readChangedFileStatusEntries(projectRoot, commandRunner);
  return Array.from(collectChangedFilesFromStatus(projectRoot, entries)).sort();
}

export function isAnalyzableFile(filePath: string): boolean {
  const normalized = toRelativePath(path.parse(filePath).root, filePath).toLowerCase();
  return hasDeclarationFileSuffix(normalized) || hasAnySuffix(normalized, SOURCE_FILE_SUFFIXES);
}

interface GitStatusEntry {
  status: string;
  pathValue: string;
}

function parseGitStatusEntry(entry: string): GitStatusEntry | null {
  if (!entry) {
    return null;
  }
  return {
    status: entry.slice(0, 2),
    pathValue: entry.slice(3)
  };
}

function collectChangedFile(projectRoot: string, entry: GitStatusEntry, files: Set<string>): void {
  if (!isIncludedGitStatus(entry.status)) {
    return;
  }
  const resolvedPath = path.resolve(projectRoot, entry.pathValue);
  if (isAnalyzableFile(resolvedPath) && isUnderSourceTree(projectRoot, resolvedPath)) {
    files.add(resolvedPath);
  }
}

function collectChangedFilesFromStatus(projectRoot: string, entries: string[]): Set<string> {
  const files = new Set<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = parseGitStatusEntry(entries[index]);
    if (!entry) {
      continue;
    }
    const renameOrCopyDestination = isRenameOrCopyStatus(entry.status) ? entries[index + 1] : undefined;
    if (renameOrCopyDestination) {
      entry.pathValue = renameOrCopyDestination;
    }
    collectChangedFile(projectRoot, entry, files);
    if (isRenameOrCopyStatus(entry.status)) {
      index += 1;
    }
  }
  return files;
}

function isUnderSourceTree(projectRoot: string, filePath: string): boolean {
  const relative = toRelativePath(projectRoot, filePath).toLowerCase();
  return relative.includes("/src/") || relative.startsWith("src/");
}

function isIncludedGitStatus(status: string): boolean {
  return status === "??" || isIncludedTrackedStatus(status);
}

function isRenameOrCopyStatus(status: string): boolean {
  return status.includes("R") || status.includes("C");
}

function hasAnySuffix(value: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => value.endsWith(suffix));
}

function hasDeclarationFileSuffix(normalizedPath: string): boolean {
  return hasAnySuffix(normalizedPath, DECLARATION_FILE_SUFFIXES);
}

async function readChangedFileStatusEntries(
  projectRoot: string,
  commandRunner: CommandRunner
): Promise<string[]> {
  const result = await commandRunner(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
    projectRoot,
    {
      timeoutMs: GIT_STATUS_TIMEOUT_MS,
      maxOutputBytes: MAX_CAPTURED_GIT_OUTPUT_BYTES
    }
  );
  if (result.timedOut) {
    throw new Error(`${GIT_STATUS_COMMAND_DESCRIPTION} timed out after ${GIT_STATUS_TIMEOUT_MS}ms${formatCommandContext(result)}`);
  }
  if (result.exitCode !== 0) {
    throw new Error(readChangedFileStatusError(result));
  }
  if (!result.stdoutComplete) {
    throw new Error(
      `could not fully capture ${GIT_STATUS_COMMAND_DESCRIPTION} output; refusing incomplete changed-file detection${formatCommandContext(result)}`
    );
  }
  return result.stdout.split("\0");
}

function formatCommandContext(result: Awaited<ReturnType<CommandRunner>>): string {
  const details: string[] = [];
  const stdout = sanitizeCommandOutput(result.stdout).trim();
  const stderr = sanitizeCommandOutput(result.stderr).trim();
  if (stdout.length > 0) {
    details.push(`stdout: ${stdout}`);
  }
  if (stderr.length > 0) {
    details.push(`stderr: ${stderr}`);
  }
  return details.length === 0 ? "" : ` (${details.join("; ")})`;
}

function sanitizeCommandOutput(value: string): string {
  return value.replaceAll("\0", "\\0");
}

function isIncludedTrackedStatus(status: string): boolean {
  return !status.includes("D") && /[AMRCU]/.test(status);
}

function readChangedFileStatusError(result: Awaited<ReturnType<CommandRunner>>): string {
  const message = result.stderr.trim() || result.stdout.trim();
  return message || `${GIT_STATUS_COMMAND_DESCRIPTION} failed`;
}

async function walkForSourceRoots(
  currentDir: string,
  onSourceRoot: (sourceRoot: string) => Promise<void>,
  options: FileSelectionOptions
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const kind = classifySourceRootEntry(entry, options);
    if (kind === "skip") {
      continue;
    }
    const absolutePath = path.join(currentDir, entry.name);
    if (kind === "source-root") {
      await onSourceRoot(absolutePath);
      continue;
    }
    await walkForSourceRoots(absolutePath, onSourceRoot, options);
  }
}

function classifySourceRootEntry(
  entry: { isDirectory(): boolean; isSymbolicLink(): boolean; name: string },
  options: FileSelectionOptions
): "skip" | "source-root" | "descend" {
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    return "skip";
  }
  const lowerName = entry.name.toLowerCase();
  if (IGNORED_DIRECTORIES.has(lowerName) || shouldPruneDiscoveryDirectory(lowerName, options)) {
    return "skip";
  }
  return lowerName === "src" ? "source-root" : "descend";
}

async function walkSourceTree(
  currentDir: string,
  onFile: (filePath: string) => Promise<void>
): Promise<void> {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      continue;
    }
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectoryEntry(entry.name, absolutePath, onFile);
      continue;
    }
    if (entry.isFile()) {
      await walkFileEntry(absolutePath, onFile);
    }
  }
}

async function walkDirectoryEntry(
  entryName: string,
  absolutePath: string,
  onFile: (filePath: string) => Promise<void>
): Promise<void> {
  if (IGNORED_DIRECTORIES.has(entryName.toLowerCase())) {
    return;
  }
  await walkSourceTree(absolutePath, onFile);
}

async function walkFileEntry(absolutePath: string, onFile: (filePath: string) => Promise<void>): Promise<void> {
  if (!isAnalyzableFile(absolutePath)) {
    return;
  }
  await onFile(absolutePath);
}

async function expandDirectoryPath(
  directoryPath: string,
  files: Set<string>,
  options: FileSelectionOptions
): Promise<void> {
  if (path.basename(directoryPath).toLowerCase() === "src") {
    await walkSourceTree(directoryPath, async (filePath) => {
      files.add(path.resolve(filePath));
    });
    return;
  }

  await walkForSourceRoots(directoryPath, async (sourceRoot) => {
    await walkSourceTree(sourceRoot, async (filePath) => {
      files.add(path.resolve(filePath));
    });
  }, options);
}

function shouldPruneDiscoveryDirectory(entryName: string, options: FileSelectionOptions): boolean {
  return Boolean(options.pruneDefaultExcludedDirectories)
    && DEFAULT_EXCLUDED_SOURCE_ROOT_DISCOVERY_DIRECTORIES.has(entryName);
}
