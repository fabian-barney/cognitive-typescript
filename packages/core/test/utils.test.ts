import { describe, expect, it } from "vitest";

import { runCommand } from "../src/utils";

describe("runCommand", () => {
  it("times out long-running commands while preserving partial output", async () => {
    const result = await runCommand(
      process.execPath,
      ["-e", "process.stdout.write('partial\\n'); setInterval(() => process.stdout.write('tick\\n'), 25);"],
      process.cwd(),
      { timeoutMs: 300 }
    );

    expect(result.timedOut).toBe(true);
    expect(result.stdout).toContain("partial");
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

});
