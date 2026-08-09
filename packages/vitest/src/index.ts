import {
  DEFAULT_JUNIT_REPORT,
  resolveReporterReportOptions,
  runReporterAnalysis
} from "@barney-media/cognitive-typescript-core";
import type { ReporterReportOptions, ResolvedReporterReportOptions } from "@barney-media/cognitive-typescript-core";

type VitestReporterEntry =
  | string
  | [string, unknown]
  | {
      onTestRunEnd?: () => Promise<void>;
      onFinishedReportCoverage?: () => Promise<void>;
    };

type VitestConfig = Record<string, unknown> & {
  test?: Record<string, unknown> & {
    reporters?: VitestReporterEntry[] | VitestReporterEntry;
  };
};

// Preserve the exported interface shape for downstream declaration merging.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CognitiveTypescriptVitestOptions extends ReporterReportOptions {}

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
      await runReporterAnalysis(options);
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

function resolveReporterOptions(options: CognitiveTypescriptVitestOptions): ResolvedReporterReportOptions {
  return resolveReporterReportOptions(options, DEFAULT_JUNIT_REPORT);
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
