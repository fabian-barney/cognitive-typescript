import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

describe("render-release-notes", () => {
  it("prefers an explicit tag argument over GITHUB_REF_NAME", async () => {
    const result = await renderReleaseNotes("v0.3.0", "v0.2.2");

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout.startsWith("### Changed")).toBe(true);
    expect(result.stdout).toContain("Reduced the default Cognitive Complexity threshold from `15` to `8`.");
    expect(result.stdout).not.toContain("Updated vite from 8.0.15 to 8.0.16.");
  });
});

function renderReleaseNotes(tag: string, githubRefName: string): Promise<ProcessResult> {
  const isWindows = process.platform === "win32";
  const command = isWindows ? (process.env.ComSpec ?? "cmd.exe") : "npm";
  const args = isWindows
    ? ["/d", "/s", "/c", `npm run --silent render-release-notes -- ${tag}`]
    : ["run", "--silent", "render-release-notes", "--", tag];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, GITHUB_REF_NAME: githubRefName },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      resolve({ exitCode: exitCode ?? 1, stdout, stderr });
    });
  });
}

interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}
