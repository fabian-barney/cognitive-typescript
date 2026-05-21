import { describe, expect, it } from "vitest";

import { runCommand } from "../src/utils";

describe("runCommand", () => {
  it("times out long-running commands while preserving partial output", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "process.stdout.write('partial\\n'); setInterval(() => process.stdout.write('tick\\n'), 25);"],
      process.cwd(),
      { timeoutMs: 1_000 }
    );

    expect(result.timedOut).toBe(true);
    expect(result.stdout).toContain("partial");
    expect(result.stdoutComplete).toBe(false);
    expect(result.stderrComplete).toBe(false);
  });

  it("bounds captured output and marks incomplete streams", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(100_000));"],
      process.cwd(),
      { maxOutputBytes: 1024 }
    );

    expect(result.stdoutComplete).toBe(false);
    expect(result.stdout).toContain("[output truncated]");
    expect(result.stdout.length).toBeLessThan(2_000);
  });

  it("preserves leading whitespace when incomplete output is truncated", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "process.stdout.write(' M src/changed.ts\\n'); process.stdout.write('x'.repeat(100_000));"],
      process.cwd(),
      { maxOutputBytes: 32 }
    );

    expect(result.stdoutComplete).toBe(false);
    expect(result.stdout.startsWith(" M src/changed.ts")).toBe(true);
    expect(result.stdout).toContain("[output truncated]");
  });

  it("captures complete output without a byte cap", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "process.stdout.write('complete output');"],
      process.cwd()
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdoutComplete).toBe(true);
    expect(result.stdout).toBe("complete output");
  });

  it("rejects spawn failures without leaving timeout cleanup behind", async () => {
    await expect(runCommand("__definitely_missing_command__", [], process.cwd(), { timeoutMs: 300 })).rejects.toThrow();
  });
});
