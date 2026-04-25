import {
  analyzeProject,
  COGNITIVE_COMPLEXITY_THRESHOLD,
  formatReport,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE
} from "@barney-media/cognitive-typescript-core";
import type { Writer } from "@barney-media/cognitive-typescript-core";

export const KARMA_REPORTER_NAME = "cognitive-typescript";

export interface CognitiveTypescriptKarmaOptions {
  projectRoot?: string;
  changedOnly?: boolean;
  paths?: string[];
  stdout?: Writer;
  stderr?: Writer;
}

export interface CognitiveTypescriptKarmaConfig extends Record<string, unknown> {
  cognitiveTypescript?: CognitiveTypescriptKarmaOptions;
  plugins?: KarmaPluginEntry[] | KarmaPluginEntry;
  reporters?: string[] | string;
}

interface ResolvedReporterOptions {
  projectRoot: string;
  paths: string[];
  changedOnly: boolean;
  stdout: Writer;
  stderr: Writer;
}

interface KarmaRunResults {
  exitCode?: number;
}

type KarmaDone = (exitCode?: number) => void;
type KarmaAdapter = (chunk: string) => void;
type BaseReporterDecorator = (reporter: CognitiveTypescriptKarmaReporter) => void;
export type KarmaPluginEntry = string | Record<string, unknown>;
type KarmaReporterRegistration = ["factory", typeof createCognitiveTypescriptKarmaReporter];

export class CognitiveTypescriptKarmaReporter {
  static readonly $inject = ["baseReporterDecorator", "config"];

  adapters: KarmaAdapter[] = [];
  onRunStart: () => void;
  onRunComplete: (_browsers?: unknown, results?: KarmaRunResults) => Promise<void>;
  onExit: (done: KarmaDone) => void;

  private error: Error | undefined;
  private exitCode: number | undefined;
  private finalizePromise: Promise<void> | null = null;
  private readonly options: CognitiveTypescriptKarmaOptions;

  constructor(
    _baseReporterDecorator?: BaseReporterDecorator,
    config: CognitiveTypescriptKarmaConfig = {}
  ) {
    this.options = config.cognitiveTypescript ?? {};

    this.onRunStart = () => {
      void this.finalizeOnce();
    };

    this.onRunComplete = (_browsers?: unknown, results?: KarmaRunResults) =>
      this.finalizeOnce().then(() => {
        if (this.exitCode && results) {
          results.exitCode = this.exitCode;
        }
      });

    this.onExit = (done: KarmaDone) => {
      if (!this.finalizePromise) {
        done(this.exitCode);
        return;
      }

      this.finalizeOnce().then(
        () => done(this.exitCode),
        (error) => {
          this.handleError(error);
          done(1);
        }
      );
    };
  }

  getLastError(): Error | undefined {
    return this.error;
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
        this.error = new Error(
          `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${COGNITIVE_COMPLEXITY_THRESHOLD}`
        );
        this.exitCode = 1;
        options.stderr.write(`${this.error.message}\n`);
        process.exitCode = 1;
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): void {
    this.error = toError(error);
    this.exitCode = 1;
    const options = resolveReporterOptions(this.options);
    options.stderr.write(`${this.error.message}\n`);
    process.exitCode = 1;
  }
}

export function withCognitiveTypescriptKarma(
  config: CognitiveTypescriptKarmaConfig = {},
  options: CognitiveTypescriptKarmaOptions = {}
): CognitiveTypescriptKarmaConfig {
  return {
    ...config,
    plugins: ensureCognitiveKarmaPlugin(asArray<KarmaPluginEntry>(config.plugins)),
    reporters: ensureCognitiveKarmaReporter(asArray(config.reporters)),
    cognitiveTypescript: {
      ...(config.cognitiveTypescript ?? {}),
      ...options
    }
  };
}

export function createCognitiveTypescriptKarmaReporter(
  baseReporterDecorator?: BaseReporterDecorator,
  config: CognitiveTypescriptKarmaConfig = {}
): CognitiveTypescriptKarmaReporter {
  return new CognitiveTypescriptKarmaReporter(baseReporterDecorator, config);
}

createCognitiveTypescriptKarmaReporter.$inject = ["baseReporterDecorator", "config"];

export const karmaPlugin: Record<string, KarmaReporterRegistration> = {
  [`reporter:${KARMA_REPORTER_NAME}`]: ["factory", createCognitiveTypescriptKarmaReporter]
};

const cjsExport = Object.assign(karmaPlugin, {
  KARMA_REPORTER_NAME,
  CognitiveTypescriptKarmaReporter,
  createCognitiveTypescriptKarmaReporter,
  withCognitiveTypescriptKarma,
  karmaPlugin
});

export default cjsExport;

Object.assign(exports, cjsExport);

function resolveReporterOptions(options: CognitiveTypescriptKarmaOptions): ResolvedReporterOptions {
  return {
    projectRoot: options.projectRoot ?? process.cwd(),
    paths: options.paths ?? [],
    changedOnly: options.changedOnly ?? false,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr
  };
}

function asArray<T>(value: T[] | T | undefined): T[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? [...value] : [value];
}

function ensureCognitiveKarmaReporter(existing: string[]): string[] {
  const reporters = existing.length === 0 ? ["progress"] : [...existing];
  if (!reporters.includes("progress")) {
    reporters.unshift("progress");
  }
  if (!reporters.includes(KARMA_REPORTER_NAME)) {
    reporters.push(KARMA_REPORTER_NAME);
  }
  return reporters;
}

function ensureCognitiveKarmaPlugin(existing: KarmaPluginEntry[]): KarmaPluginEntry[] {
  if (existing.some(isCognitiveKarmaPlugin)) {
    return existing;
  }
  return [...existing, karmaPlugin];
}

function isCognitiveKarmaPlugin(entry: KarmaPluginEntry): boolean {
  return typeof entry === "object" && entry !== null && `reporter:${KARMA_REPORTER_NAME}` in entry;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
