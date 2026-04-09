import path from "node:path";

import { analyzeProject } from "./analyzeProject";
import {
  COGNITIVE_COMPLEXITY_THRESHOLD,
  NO_ANALYZABLE_FUNCTIONS_MESSAGE,
  NO_FILES_MESSAGE
} from "./constants";
import { formatReport } from "./report";
import { writeLine } from "./utils";
import type { CliArguments, Writer } from "./types";

const HELP_TEXT = `cognitive-typescript

Usage:
  cognitive-typescript [--help]
  cognitive-typescript [--changed]
  cognitive-typescript <path ...>

Options:
  --help                     Print usage to stdout
  --changed                  Analyze changed TypeScript files under src/

Behavior:
  (no args)                  Analyze all TypeScript files under any nested src/ tree
  <file ...>                 Analyze explicit TypeScript files
  <directory ...>            Analyze TypeScript files under each directory's nested src/ tree
`;

export function usage(): string {
  return HELP_TEXT;
}

export function parseCliArguments(args: string[]): CliArguments {
  if (args.length === 0) {
    return { mode: "all", fileArgs: [] };
  }

  const state = createCliParseState();
  for (const arg of args) {
    applyCliArgument(state, arg);
  }
  return finalizeCliArguments(state);
}

export async function runCli(
  args: string[],
  projectRoot = process.cwd(),
  stdout: Writer = process.stdout,
  stderr: Writer = process.stderr
): Promise<number> {
  const parsed = parseCliInputs(args, stdout, stderr);
  if (typeof parsed === "number") {
    return parsed;
  }
  if (parsed.mode === "help") {
    writeLine(stdout, usage());
    return 0;
  }

  const result = await analyzeCliProject(parsed, projectRoot, stderr);
  if (!result) {
    return 1;
  }
  if (result.selectedFiles.length === 0) {
    writeLine(stdout, NO_FILES_MESSAGE);
    return 0;
  }
  if (result.metrics.length === 0) {
    writeLine(stdout, NO_ANALYZABLE_FUNCTIONS_MESSAGE);
    return 0;
  }

  writeLine(stdout, formatReport(result.metrics));
  if (!result.thresholdExceeded) {
    return 0;
  }
  writeLine(
    stderr,
    `Cognitive Complexity threshold exceeded: ${result.maxCognitiveComplexity} > ${COGNITIVE_COMPLEXITY_THRESHOLD}`
  );
  return 2;
}

function parseCliInputs(args: string[], stdout: Writer, stderr: Writer): CliArguments | number {
  try {
    return parseCliArguments(args);
  } catch (error) {
    writeLine(stderr, (error as Error).message);
    writeLine(stdout, usage());
    return 1;
  }
}

async function analyzeCliProject(
  parsed: CliArguments,
  projectRoot: string,
  stderr: Writer
) {
  try {
    return await analyzeProject({
      projectRoot: path.resolve(projectRoot),
      explicitPaths: parsed.mode === "explicit" ? parsed.fileArgs : [],
      changedOnly: parsed.mode === "changed"
    });
  } catch (error) {
    writeLine(stderr, (error as Error).message);
    return null;
  }
}

interface CliParseState {
  help: boolean;
  changed: boolean;
  fileArgs: string[];
}

function createCliParseState(): CliParseState {
  return {
    help: false,
    changed: false,
    fileArgs: []
  };
}

function applyCliArgument(state: CliParseState, arg: string): void {
  if (!arg.startsWith("--")) {
    state.fileArgs.push(arg);
    return;
  }
  applyCliOption(state, arg);
}

function applyCliOption(state: CliParseState, arg: string): void {
  switch (arg) {
    case "--help":
      state.help = true;
      return;
    case "--changed":
      state.changed = true;
      return;
    default:
      throw new Error(`Unknown option: ${arg}`);
  }
}

function finalizeCliArguments(state: CliParseState): CliArguments {
  if (state.help) {
    return { mode: "help", fileArgs: [] };
  }
  if (state.changed && state.fileArgs.length > 0) {
    throw new Error("--changed cannot be combined with file arguments");
  }
  return {
    mode: resolveCliMode(state),
    fileArgs: state.fileArgs
  };
}

function resolveCliMode(state: CliParseState): CliArguments["mode"] {
  if (state.changed) {
    return "changed";
  }
  return state.fileArgs.length > 0 ? "explicit" : "all";
}
