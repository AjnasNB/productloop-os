import { describe, expect, it } from "vitest";
import { runCli } from "../src/cli.js";

describe("productloop-os CLI", () => {
  it("reports dependency health as JSON", async () => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const code = await runCli(["doctor", "--json"], {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message)
    });

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    const report = JSON.parse(stdout.join("\n")) as {
      ok: boolean;
      version: string;
      modules: Array<{ loaded: boolean }>;
      externalCapabilities: { checked: boolean };
    };
    expect(report.ok).toBe(true);
    expect(report.version).toBe("0.2.1");
    expect(report.modules).toHaveLength(9);
    expect(report.modules.every((module) => module.loaded)).toBe(true);
    expect(report.externalCapabilities.checked).toBe(false);
  });
});
