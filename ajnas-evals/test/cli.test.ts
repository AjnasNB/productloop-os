import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";

describe("ajnas-evals CLI", () => {
  test("validates, digests, runs, and verifies eval reports", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = {
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line)
    };

    await expect(runCli(["validate", "fixtures/release-eval-suite.json"], io)).resolves.toBe(0);
    expect(stdout[0]).toBe("valid: true");
    expect(stdout[1]).toMatch(/^digest: sha256:[a-f0-9]{64}$/);

    stdout.length = 0;
    await expect(runCli(["digest", "fixtures/release-eval-suite.json"], io)).resolves.toBe(0);
    expect(stdout[0]).toMatch(/^sha256:[a-f0-9]{64}$/);

    stdout.length = 0;
    await expect(runCli(["run", "fixtures/release-eval-suite.json", "fixtures/release-run-artifacts.json"], io)).resolves.toBe(0);
    const report = JSON.parse(stdout.join("\n"));
    expect(report.summary.failedCases).toBe(0);
    expect(report.digest).toMatch(/^sha256:[a-f0-9]{64}$/);

    const reportPath = join(tmpdir(), `ajnas-evals-report-${Date.now()}.json`);
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    stdout.length = 0;
    await expect(runCli(["verify-report", reportPath], io)).resolves.toBe(0);
    expect(stdout).toEqual(["valid: true"]);

    expect(stderr).toEqual([]);
    expect(await readFile(reportPath, "utf8")).toContain("\"schemaVersion\": \"ajnas.eval.report.v1\"");
  });

  test("verifies reports saved with Windows PowerShell UTF-16LE redirection", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const io = {
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line)
    };

    await expect(runCli(["run", "fixtures/release-eval-suite.json", "fixtures/release-run-artifacts.json"], io)).resolves.toBe(0);
    const reportPath = join(tmpdir(), `ajnas-evals-report-utf16-${Date.now()}.json`);
    await writeFile(reportPath, Buffer.from(`\ufeff${stdout.join("\n")}`, "utf16le"));

    stdout.length = 0;
    await expect(runCli(["verify-report", reportPath], io)).resolves.toBe(0);

    expect(stdout).toEqual(["valid: true"]);
    expect(stderr).toEqual([]);
  });
});
