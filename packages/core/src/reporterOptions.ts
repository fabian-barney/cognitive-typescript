import { COGNITIVE_COMPLEXITY_THRESHOLD } from "./constants";
import type { ReportFormat, ReporterReportOptions, ResolvedReporterReportOptions, Writer } from "./types";

export function resolveReporterReportOptions(
  options: ReporterReportOptions,
  defaultJunitReport: string
): ResolvedReporterReportOptions {
  const agent = optionOr(options.agent, false);
  return {
    projectRoot: optionOr(options.projectRoot, process.cwd()),
    paths: options.paths ?? [],
    changedOnly: optionOr(options.changedOnly, false),
    format: resolveFormat(options.format, agent),
    agent,
    failuresOnly: options.failuresOnly,
    omitRedundancy: options.omitRedundancy,
    output: options.output,
    junit: optionOr(options.junit, true),
    junitReport: optionOr(options.junitReport, defaultJunitReport),
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
