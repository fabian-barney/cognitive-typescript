import path from "node:path";

import { COGNITIVE_COMPLEXITY_THRESHOLD } from "./constants";
import type { ReportFormat, ReporterReportOptions, ResolvedReporterReportOptions } from "./types";

export const DEFAULT_JUNIT_REPORT = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");

export function resolveReporterReportOptions(
  options: ReporterReportOptions,
  defaultJunitReport: string = DEFAULT_JUNIT_REPORT
): ResolvedReporterReportOptions {
  const agent = optionOr(options.agent, false);
  const output = resolvePathOption(options.output, "--output");
  const junitReport = resolvePathOption(options.junitReport, "--junit-report") ?? defaultJunitReport;
  return {
    projectRoot: optionOr(options.projectRoot, process.cwd()),
    paths: options.paths ?? [],
    changedOnly: optionOr(options.changedOnly, false),
    excludes: normalizeListOption(options.excludes, "--exclude"),
    excludeNames: normalizeListOption(options.excludeNames, "--exclude-name"),
    excludeDecorators: normalizeListOption(options.excludeDecorators, "--exclude-decorator"),
    excludeComments: normalizeListOption(options.excludeComments, "--exclude-comment"),
    useDefaultExclusions: optionOr(options.useDefaultExclusions, true),
    format: resolveFormat(options.format, agent),
    agent,
    failuresOnly: options.failuresOnly,
    omitRedundancy: options.omitRedundancy,
    output,
    junit: optionOr(options.junit, true),
    junitReport,
    threshold: optionOr(options.threshold, COGNITIVE_COMPLEXITY_THRESHOLD),
    stdout: optionOr(options.stdout, process.stdout),
    stderr: optionOr(options.stderr, process.stderr)
  };
}

function resolveFormat(format: ReportFormat | undefined, agent: boolean): ReportFormat {
  if (format !== undefined) {
    return format;
  }
  return agent ? "toon" : "none";
}

function optionOr<T>(value: T | undefined, fallback: T): T {
  return value ?? fallback;
}

function resolvePathOption(value: string | undefined, option: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    throw new Error(`${option} requires a path`);
  }
  if (trimmedValue !== value) {
    throw new Error(`${option} must not include leading or trailing whitespace`);
  }
  return value;
}

function normalizeListOption(values: string[] | undefined, option: string): string[] {
  return (values ?? []).map((value) => {
    const trimmedValue = value.trim();
    if (trimmedValue === "") {
      throw new Error(`${option} requires a value`);
    }
    if (trimmedValue !== value) {
      throw new Error(`${option} must not include leading or trailing whitespace`);
    }
    return value;
  });
}
