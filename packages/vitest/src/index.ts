import path from "node:path";

import {
  analyzeProject,
  COGNITIVE_COMPLEXITY_THRESHOLD,
  deleteOwnedReportFile,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE,
  publishAnalysisReports,
  validateReportPathTargets
} from "@barney-media/cognitive-typescript-core";
import type { ReportFormat, Writer } from "@barney-media/cognitive-typescript-core";

type VitestReporterEntry = string | [string, unknown] | {
  onTestRunEnd?: () => Promise<void>;
  onFinishedReportCoverage?: () => Promise<void>;
};

type VitestConfig = Record<string, unknown> & {
  test?: Record<string, unknown> & {
    reporters?: VitestReporterEntry[] | VitestReporterEntry;
  };
};

export interface CognitiveTypescriptVitestOptions {
  projectRoot?: string;
  changedOnly?: boolean;
  paths?: string[];
  format?: ReportFormat;
  agent?: boolean;
  failuresOnly?: boolean;
  omitRedundancy?: boolean;
  output?: string;
  junit?: boolean;
  junitReport?: string;
  threshold?: number;
  stdout?: Writer;
  stderr?: Writer;
}

interface ResolvedReporterOptions {
  projectRoot: string;
  paths: string[];
  changedOnly: boolean;
  format: ReportFormat;
  agent: boolean;
  failuresOnly: boolean | undefined;
  omitRedundancy: boolean | undefined;
  output: string | undefined;
  junit: boolean;
  junitReport: string;
  threshold: number;
  stdout: Writer;
  stderr: Writer;
}

const DEFAULT_JUNIT_REPORT = path.join("reports", "cognitive-typescript", "TEST-cognitive-typescript.xml");

export class CognitiveTypescriptVitestReporter {
  private finalizePromise: Promise<void> | null = null;

  constructor(private readonly options: CognitiveTypescriptVitestOptions = {}) {}

  async onTestRunEnd(): Promise<void> {
    await this.finalizeOnce();
  }

  async onFinishedReportCoverage(): Promise<void> {
    await this.finalizeOnce();
  }

  private async finalizeOnce(): Promise<void> {
    if (!this.finalizePromise) {
      this.finalizePromise = this.finalize();
    }
    await this.finalizePromise;
  }

  private async finalize(): Promise<void> {
    const options = resolveReporterOptions(this.options);
    try {
      await validateReportPathTargets(options.projectRoot, [
        { label: "--output", path: options.output },
        { label: "--junit-report", path: options.junitReport }
      ]);
      if (!options.junit) {
        await deleteOwnedReportFile(options.projectRoot, options.junitReport);
      }

      const result = await analyzeProject({
        projectRoot: options.projectRoot,
        explicitPaths: options.paths,
        changedOnly: options.changedOnly,
        threshold: options.threshold
      });

      if (result.selectedFiles.length === 0) {
        options.stdout.write(`${NO_FILES_MESSAGE}\n`);
        return;
      }
      if (result.metrics.length === 0) {
        options.stdout.write(`${NO_ANALYZABLE_FUNCTIONS_MESSAGE}\n`);
        return;
      }

      await publishAnalysisReports({
        projectRoot: options.projectRoot,
        stdout: options.stdout,
        metrics: result.metrics,
        format: options.format,
        agent: options.agent,
        threshold: result.threshold,
        failuresOnly: options.failuresOnly,
        omitRedundancy: options.omitRedundancy,
        output: options.output,
        junitReport: options.junit ? options.junitReport : undefined
      });
      if (result.thresholdExceeded) {
        options.stderr.write(
          `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${result.threshold}\n`
        );
        process.exitCode = 2;
      }
    } catch (error) {
      options.stderr.write(`${toError(error).message}\n`);
      process.exitCode = 1;
    }
  }
}

export function withCognitiveTypescriptVitest(
  config: VitestConfig = {},
  options: CognitiveTypescriptVitestOptions = {}
): VitestConfig {
  const testConfig = config.test ?? {};
  const reporters = ensureDefaultReporter(asArray(testConfig.reporters));
  reporters.push(new CognitiveTypescriptVitestReporter(options));

  return {
    ...config,
    test: {
      ...testConfig,
      reporters
    }
  };
}

function resolveReporterOptions(options: CognitiveTypescriptVitestOptions): ResolvedReporterOptions {
  const agent = options.agent ?? false;
  return {
    projectRoot: options.projectRoot ?? process.cwd(),
    paths: options.paths ?? [],
    changedOnly: options.changedOnly ?? false,
    format: options.format ?? (agent ? "toon" : "none"),
    agent,
    failuresOnly: options.failuresOnly,
    omitRedundancy: options.omitRedundancy,
    output: options.output,
    junit: options.junit ?? true,
    junitReport: options.junitReport ?? DEFAULT_JUNIT_REPORT,
    threshold: options.threshold ?? COGNITIVE_COMPLEXITY_THRESHOLD,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? [...value] : [value];
}

function ensureDefaultReporter(existing: VitestReporterEntry[]): VitestReporterEntry[] {
  if (existing.length === 0) {
    return ["default"];
  }
  if (!existing.some((entry) => (Array.isArray(entry) ? entry[0] : entry) === "default")) {
    return ["default", ...existing];
  }
  return existing;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
