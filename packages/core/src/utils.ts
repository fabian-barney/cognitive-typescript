import path from "node:path";
import { spawn } from "node:child_process";

import type { Writer } from "./types";

interface RunCommandOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  env?: NodeJS.ProcessEnv;
}

interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutComplete: boolean;
  stderrComplete: boolean;
  timedOut: boolean;
}

const FORCE_KILL_TIMEOUT_MS = 1_000;

export function writeLine(writer: Writer | undefined, message: string): void {
  writer?.write(`${message}\n`);
}

export function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}

export function normalizePathForMatch(filePath: string): string {
  return normalizeSlashes(path.resolve(filePath)).toLowerCase();
}

export function isAbsolutePath(filePath: string): boolean {
  return path.isAbsolute(filePath) || path.win32.isAbsolute(filePath);
}

export function toRelativePath(projectRoot: string, filePath: string): string {
  const relative = path.relative(projectRoot, filePath);
  return normalizeSlashes(relative || path.basename(filePath));
}

export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  options: RunCommandOptions = {}
): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = createBoundedOutput(options.maxOutputBytes);
    const stderr = createBoundedOutput(options.maxOutputBytes);
    let timedOut = false;
    let timeout: NodeJS.Timeout | undefined;
    let forceKillTimeout: NodeJS.Timeout | undefined;

    const clearTimers = () => {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
      if (forceKillTimeout !== undefined) {
        clearTimeout(forceKillTimeout);
      }
    };

    timeout = options.timeoutMs === undefined
      ? undefined
      : setTimeout(() => {
        timedOut = true;
        stdout.markIncomplete();
        stderr.markIncomplete();
        child.kill();
        forceKillTimeout = setTimeout(() => {
          child.kill("SIGKILL");
        }, FORCE_KILL_TIMEOUT_MS);
      }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr.write(chunk);
    });
    child.stdout.on("error", () => {
      stdout.markIncomplete();
    });
    child.stderr.on("error", () => {
      stderr.markIncomplete();
    });
    child.on("error", (error) => {
      clearTimers();
      stdout.markIncomplete();
      stderr.markIncomplete();
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimers();
      resolve({
        exitCode: exitCode ?? 1,
        stdout: stdout.text(),
        stderr: stderr.text(),
        stdoutComplete: stdout.isComplete(),
        stderrComplete: stderr.isComplete(),
        timedOut
      });
    });
  });
}

export function formatNumber(value: number): string {
  return value.toFixed(1);
}

export function resolveScriptKind(filePath: string): "ts" | "tsx" {
  return filePath.toLowerCase().endsWith(".tsx") ? "tsx" : "ts";
}

function createBoundedOutput(maxOutputBytes: number | undefined) {
  let text = "";
  let capturedBytes = 0;
  let complete = true;

  return {
    write(chunk: Buffer | string) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const bytesToCapture = captureLength(buffer.length, maxOutputBytes, capturedBytes);
      if (bytesToCapture === 0) {
        if (buffer.length > 0) {
          complete = false;
        }
        return;
      }
      capturedBytes += bytesToCapture;
      text += buffer.subarray(0, bytesToCapture).toString();
      if (bytesToCapture < buffer.length) {
        complete = false;
      }
    },
    markIncomplete() {
      complete = false;
    },
    isComplete() {
      return complete;
    },
    text() {
      if (complete) {
        return text;
      }
      const trimmed = text.trimEnd();
      return trimmed.length === 0 ? "[output truncated]" : `${trimmed} [output truncated]`;
    }
  };
}

function captureLength(
  bufferLength: number,
  maxOutputBytes: number | undefined,
  capturedBytes: number
): number {
  if (maxOutputBytes === undefined) {
    return bufferLength;
  }
  const remaining = maxOutputBytes - capturedBytes;
  if (remaining <= 0) {
    return 0;
  }
  return Math.min(bufferLength, remaining);
}
