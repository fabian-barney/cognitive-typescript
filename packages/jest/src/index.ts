import { existsSync } from "node:fs";
import path from "node:path";

import CognitiveTypescriptJestReporter, { type CognitiveTypescriptJestOptions } from "./reporter";

type JestReporterEntry = string | [string, unknown];

export function withCognitiveTypescriptJest(
  config: Record<string, unknown> = {},
  options: CognitiveTypescriptJestOptions = {}
): Record<string, unknown> {
  const reporters = ensureDefaultReporter(
    asArray<JestReporterEntry>(config.reporters as JestReporterEntry[] | undefined)
  );
  reporters.push([resolveReporterPath(), options]);

  return {
    ...config,
    reporters
  };
}

export { CognitiveTypescriptJestReporter };
export type { CognitiveTypescriptJestOptions };
export default CognitiveTypescriptJestReporter;

function asArray<T>(value: T[] | T | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? [...value] : [value];
}

function ensureDefaultReporter(existing: JestReporterEntry[]): JestReporterEntry[] {
  if (existing.length === 0) {
    return ["default"];
  }
  if (!existing.some((entry) => (Array.isArray(entry) ? entry[0] : entry) === "default")) {
    return ["default", ...existing];
  }
  return existing;
}

function resolveReporterPath(): string {
  try {
    return require.resolve("./reporter");
  } catch {
    const candidates = [path.join(__dirname, "reporter.js"), path.join(__dirname, "reporter.ts")];
    const resolved = candidates.find((candidate) => existsSync(candidate));
    if (resolved) {
      return resolved;
    }
    throw new Error("Unable to resolve the cognitive-typescript Jest reporter module.");
  }
}
