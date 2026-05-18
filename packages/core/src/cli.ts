import path from "node:path";
import { performance } from "node:perf_hooks";

import { analyzeProject } from "./analyzeProject";
import { COGNITIVE_COMPLEXITY_THRESHOLD, validateThreshold } from "./constants";
import { publishAnalysisReports } from "./reportPublishing";
import { writeLine } from "./utils";
import type { AnalysisCliArguments, CliArguments, ReportFormat, Writer } from "./types";

const REPORT_FORMATS = ["toon", "json", "text", "junit", "none"] as const;
const REPORT_FORMAT_LIST = REPORT_FORMATS.join(", ");
const REPORT_FORMAT_ERROR = `--format requires one of: ${REPORT_FORMAT_LIST}`;

const HELP_TEXT = `cognitive-typescript

Usage:
  cognitive-typescript [--help]
  cognitive-typescript [--changed] [--format <format>] [--agent] [--failures-only[=true|false]] [--omit-redundancy[=true|false]] [--output <path>] [--junit-report <path>] [--threshold <integer>]
  cognitive-typescript [--format <format>] [--agent] [--failures-only[=true|false]] [--omit-redundancy[=true|false]] [--output <path>] [--junit-report <path>] [--threshold <integer>] <path ...>

Options:
  --help                     Print usage to stdout
  --changed                  Analyze changed TypeScript files under src/
  --format <format>          Emit ${REPORT_FORMAT_LIST} (default: toon)
  --agent                    Default primary output to --format toon --failures-only --omit-redundancy
  --failures-only[=true|false]
                             Emit failed functions only in the primary report
  --omit-redundancy[=true|false]
                             Omit redundant per-method status in the primary report
  --output <path>            Write the primary report to a file instead of stdout
  --junit-report <path>      Also write a full JUnit XML report for CI test-report UIs
  --threshold <integer>      Override the Cognitive Complexity threshold (default: 15)

Behavior:
  (no args)                  Analyze all TypeScript files under any nested src/ tree
  <file ...>                 Analyze explicit TypeScript files
  <directory ...>            Analyze TypeScript files under each directory's nested src/ tree

Exit codes:
  0                          Analysis completed and threshold respected
  1                          Parse or configuration error
  2                          Cognitive Complexity threshold exceeded
  3                          Unexpected internal error
`;

export function usage(): string {
  return HELP_TEXT;
}

export function parseCliArguments(args: string[]): CliArguments {
  const state = createParseState();

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      state.fileArgs.push(arg);
      continue;
    }
    index = consumeOption(state, args, index);
  }

  return finalizeCliArguments(state);
}

interface ParseState {
  help: boolean;
  changed: boolean;
  format: ReportFormat;
  threshold: number;
  agent: boolean;
  failuresOnly: boolean;
  omitRedundancy: boolean;
  output?: string;
  junitReport?: string;
  helpSeen: boolean;
  changedSeen: boolean;
  formatSeen: boolean;
  thresholdSeen: boolean;
  agentSeen: boolean;
  failuresOnlySeen: boolean;
  omitRedundancySeen: boolean;
  outputSeen: boolean;
  junitReportSeen: boolean;
  fileArgs: string[];
}

type OptionHandler = (state: ParseState, args: string[], index: number, value: string | undefined) => number;
type BooleanOptionHandler = (state: ParseState, value: string | undefined) => void;

const OPTION_HANDLERS: Record<string, OptionHandler> = {
  "--help": (state, _args, index) => {
    ensureOptionIsUnique(state.helpSeen, "--help");
    state.help = true;
    state.helpSeen = true;
    return index;
  },
  "--changed": (state, _args, index) => {
    ensureOptionIsUnique(state.changedSeen, "--changed");
    state.changed = true;
    state.changedSeen = true;
    return index;
  },
  "--agent": (state, _args, index) => {
    ensureOptionIsUnique(state.agentSeen, "--agent");
    state.agent = true;
    state.agentSeen = true;
    return index;
  },
  "--format": (state, args, index, value) => {
    ensureOptionIsUnique(state.formatSeen, "--format");
    state.format = parseReportFormatOption(args, index, value);
    state.formatSeen = true;
    return value === undefined ? index + 1 : index;
  },
  "--threshold": (state, args, index, value) => {
    ensureOptionIsUnique(state.thresholdSeen, "--threshold");
    state.threshold = parseThreshold(optionValue(args, index, value, "--threshold", "a positive integer"));
    state.thresholdSeen = true;
    return value === undefined ? index + 1 : index;
  },
  "--output": (state, args, index, value) => {
    ensureOptionIsUnique(state.outputSeen, "--output");
    state.output = parsePathOption(optionValue(args, index, value, "--output", "a path"), "--output");
    state.outputSeen = true;
    return value === undefined ? index + 1 : index;
  },
  "--junit-report": (state, args, index, value) => {
    ensureOptionIsUnique(state.junitReportSeen, "--junit-report");
    state.junitReport = parsePathOption(optionValue(args, index, value, "--junit-report", "a path"), "--junit-report");
    state.junitReportSeen = true;
    return value === undefined ? index + 1 : index;
  }
};

const BOOLEAN_OPTION_HANDLERS: Record<string, BooleanOptionHandler> = {
  "--failures-only": parseFailuresOnly,
  "--omit-redundancy": parseOmitRedundancy
};

function createParseState(): ParseState {
  return {
    help: false,
    changed: false,
    format: "toon",
    threshold: COGNITIVE_COMPLEXITY_THRESHOLD,
    agent: false,
    failuresOnly: false,
    omitRedundancy: false,
    output: undefined,
    junitReport: undefined,
    helpSeen: false,
    changedSeen: false,
    formatSeen: false,
    thresholdSeen: false,
    agentSeen: false,
    failuresOnlySeen: false,
    omitRedundancySeen: false,
    outputSeen: false,
    junitReportSeen: false,
    fileArgs: []
  };
}

function consumeOption(state: ParseState, args: string[], index: number): number {
  const [option, value] = splitAssignedOption(args[index]);
  const booleanHandler = BOOLEAN_OPTION_HANDLERS[option];
  if (booleanHandler) {
    booleanHandler(state, value);
    return index;
  }

  const handler = OPTION_HANDLERS[option];
  if (!handler) {
    throw new Error(`Unknown option: ${args[index]}`);
  }
  return handler(state, args, index, value);
}

function ensureOptionIsUnique(seen: boolean, option: string): void {
  if (seen) {
    throw new Error(`${option} can only be provided once`);
  }
}

function finalizeCliArguments(state: ParseState): CliArguments {
  validateHelpIsStandalone(state);
  if (state.help) {
    return {
      mode: "help",
      fileArgs: []
    };
  }
  applyAgentDefaults(state);
  validateCliState(state);

  return {
    mode: cliMode(state),
    fileArgs: state.fileArgs,
    format: state.format,
    threshold: state.threshold,
    agent: state.agent,
    failuresOnly: state.failuresOnly,
    omitRedundancy: state.omitRedundancy,
    ...optionalPath("output", state.output),
    ...optionalPath("junitReport", state.junitReport)
  };
}

function applyAgentDefaults(state: ParseState): void {
  if (!state.agent) {
    return;
  }
  state.format = state.formatSeen ? state.format : "toon";
  state.failuresOnly = state.failuresOnlySeen ? state.failuresOnly : true;
  state.omitRedundancy = state.omitRedundancySeen ? state.omitRedundancy : true;
}

function validateCliState(state: ParseState): void {
  if (state.help) {
    return;
  }
  if (state.changed && state.fileArgs.length > 0) {
    throw new Error("--changed cannot be combined with file arguments");
  }
}

function validateHelpIsStandalone(state: ParseState): void {
  if (state.help && hasHelpConflicts(state)) {
    throw new Error("--help cannot be combined with other options or file arguments");
  }
}

function hasHelpConflicts(state: ParseState): boolean {
  return [
    state.changedSeen,
    state.formatSeen,
    state.thresholdSeen,
    state.agentSeen,
    state.failuresOnlySeen,
    state.omitRedundancySeen,
    state.outputSeen,
    state.junitReportSeen,
    state.fileArgs.length > 0
  ].some(Boolean);
}

function cliMode(state: ParseState): AnalysisCliArguments["mode"] {
  if (state.changed) {
    return "changed";
  }
  return state.fileArgs.length > 0 ? "explicit" : "all";
}

function optionalPath<K extends "output" | "junitReport">(
  key: K,
  value: string | undefined
): Partial<Pick<AnalysisCliArguments, K>> {
  return value === undefined ? {} : { [key]: value } as Pick<AnalysisCliArguments, K>;
}

function parseReportFormat(value: string | undefined): ReportFormat {
  if (value && isReportFormat(value)) {
    return value;
  }
  throw new Error(REPORT_FORMAT_ERROR);
}

function isReportFormat(value: string): value is ReportFormat {
  return (REPORT_FORMATS as readonly string[]).includes(value);
}

function parseThreshold(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new Error("--threshold requires a positive integer");
  }
  try {
    return validateThreshold(Number(value));
  } catch {
    throw new Error("--threshold requires a positive integer");
  }
}

function splitAssignedOption(arg: string): [string, string | undefined] {
  const equalsIndex = arg.indexOf("=");
  if (equalsIndex < 0) {
    return [arg, undefined];
  }
  return [arg.slice(0, equalsIndex), arg.slice(equalsIndex + 1)];
}

function parseFailuresOnly(state: ParseState, value: string | undefined): void {
  ensureOptionIsUnique(state.failuresOnlySeen, "--failures-only");
  state.failuresOnly = parseBooleanOption(value, "--failures-only");
  state.failuresOnlySeen = true;
}

function parseOmitRedundancy(state: ParseState, value: string | undefined): void {
  ensureOptionIsUnique(state.omitRedundancySeen, "--omit-redundancy");
  state.omitRedundancy = parseBooleanOption(value, "--omit-redundancy");
  state.omitRedundancySeen = true;
}

function parseBooleanOption(value: string | undefined, option: string): boolean {
  if (value === undefined) {
    return true;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`${option} requires true or false when a value is provided`);
}

function optionValue(
  args: string[],
  index: number,
  inlineValue: string | undefined,
  option: string,
  valueDescription: string
): string {
  if (inlineValue !== undefined) {
    if (inlineValue === "") {
      throw new Error(`${option} requires ${valueDescription}`);
    }
    return inlineValue;
  }
  if (index + 1 >= args.length) {
    throw new Error(`${option} requires ${valueDescription}`);
  }
  const separatedValue = args[index + 1];
  if (separatedValue.startsWith("--")) {
    throw new Error(`${option} requires ${valueDescription}`);
  }
  return separatedValue;
}

function parsePathOption(value: string, option: string): string {
  const trimmedValue = value.trim();
  if (trimmedValue === "") {
    throw new Error(`${option} requires a path`);
  }
  if (trimmedValue !== value) {
    throw new Error(`${option} must not include leading or trailing whitespace`);
  }
  return value;
}

function parseReportFormatOption(args: string[], index: number, inlineValue: string | undefined): ReportFormat {
  return parseReportFormat(optionValue(args, index, inlineValue, "--format", "a format"));
}

export async function runCli(
  args: string[],
  projectRoot = process.cwd(),
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr
): Promise<number> {
  const parsed = parseCliInputs(args, stderr);
  if (typeof parsed === "number") {
    return parsed;
  }
  if (parsed.mode === "help") {
    writeLine(stdout, usage());
    return 0;
  }

  const startedAt = performance.now();
  return handleCliResult(
    await analyzeCliProject(parsed, projectRoot, stderr),
    parsed,
    projectRoot,
    stdout,
    stderr,
    startedAt
  );
}

function parseCliInputs(args: string[], stderr: Writer): CliArguments | number {
  try {
    return parseCliArguments(args);
  } catch (error) {
    writeLine(stderr, (error as Error).message);
    writeLine(stderr, usage());
    return 1;
  }
}

async function analyzeCliProject(
  parsed: AnalysisCliArguments,
  projectRoot: string,
  stderr: Writer
) {
  try {
    return await analyzeProject({
      projectRoot: path.resolve(projectRoot),
      explicitPaths: parsed.mode === "explicit" ? parsed.fileArgs : [],
      changedOnly: parsed.mode === "changed",
      threshold: parsed.threshold,
      stderr
    });
  } catch (error) {
    writeLine(stderr, (error as Error).message);
    return null;
  }
}

async function handleCliResult(
  result: Awaited<ReturnType<typeof analyzeProject>> | null,
  parsed: AnalysisCliArguments,
  projectRoot: string,
  stdout: Writer,
  stderr: Writer,
  startedAt: number
): Promise<number> {
  if (!result) {
    return 1;
  }

  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  try {
    await writeCliReports(result, parsed, projectRoot, stdout, elapsedSeconds);
  } catch (error) {
    writeLine(stderr, (error as Error).message);
    return 1;
  }

  return writeCliThresholdStatus(result, stderr);
}

async function writeCliReports(
  result: Awaited<ReturnType<typeof analyzeProject>>,
  parsed: AnalysisCliArguments,
  projectRoot: string,
  stdout: Writer,
  elapsedSeconds: number
): Promise<void> {
  await publishAnalysisReports({
    projectRoot,
    stdout,
    metrics: result.metrics,
    format: parsed.format,
    agent: parsed.agent,
    threshold: result.threshold,
    failuresOnly: parsed.failuresOnly,
    omitRedundancy: parsed.omitRedundancy,
    output: parsed.output,
    junitReport: parsed.junitReport,
    elapsedSeconds
  });
}

function writeCliThresholdStatus(
  result: Awaited<ReturnType<typeof analyzeProject>>,
  stderr: Writer
): number {
  if (!result.thresholdExceeded) {
    return 0;
  }
  writeLine(
    stderr,
    `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${result.threshold}`
  );
  return 2;
}
