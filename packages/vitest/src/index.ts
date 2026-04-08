import {
  analyzeProject,
  COGNITIVE_COMPLEXITY_THRESHOLD,
  formatReport,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE
} from "@barney-media/cognitive-typescript-core";
import type { Writer } from "@barney-media/cognitive-typescript-core";

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
  stdout?: Writer;
  stderr?: Writer;
}

interface ResolvedReporterOptions {
  projectRoot: string;
  paths: string[];
  changedOnly: boolean;
  stdout: Writer;
  stderr: Writer;
}

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
    const result = await analyzeProject({
      projectRoot: options.projectRoot,
      explicitPaths: options.paths,
      changedOnly: options.changedOnly
    });

    if (result.selectedFiles.length === 0) {
      options.stdout.write(`${NO_FILES_MESSAGE}\n`);
      return;
    }
    if (result.metrics.length === 0) {
      options.stdout.write(`${NO_ANALYZABLE_FUNCTIONS_MESSAGE}\n`);
      return;
    }

    options.stdout.write(`${formatReport(result.metrics)}\n`);
    if (result.thresholdExceeded) {
      options.stderr.write(
        `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${COGNITIVE_COMPLEXITY_THRESHOLD}\n`
      );
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
  return {
    projectRoot: options.projectRoot ?? process.cwd(),
    paths: options.paths ?? [],
    changedOnly: options.changedOnly ?? false,
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
