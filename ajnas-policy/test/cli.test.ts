import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { runCli, type PolicyBundle } from "../src/index.js";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ajnas-policy-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function cliBundle(): PolicyBundle {
  return {
    schemaVersion: "ajnas.policy.bundle.v1",
    id: "com.ajnas.cli",
    version: "1.0.0",
    defaultEffect: "deny",
    rules: [
      {
        id: "review-npm-publish",
        effect: "require_approval",
        reason: "npm publishing requires review",
        approvalPrompt: "Review {toolName} for {destination}.",
        match: {
          toolNamePatterns: ["packages.*"],
          destinations: ["npm"]
        }
      }
    ]
  };
}

async function writeJson(name: string, value: unknown): Promise<string> {
  const filePath = join(tempDir, name);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

describe("ajnas-policy CLI", () => {
  test("validates policy bundles and prints deterministic digests", async () => {
    const bundlePath = await writeJson("bundle.json", cliBundle());
    const stdout: string[] = [];
    const stderr: string[] = [];

    const code = await runCli(["validate", bundlePath], {
      stdout: (line) => stdout.push(line),
      stderr: (line) => stderr.push(line)
    });

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("\n")).toContain("valid: true");
    expect(stdout.join("\n")).toMatch(/sha256:[a-f0-9]{64}/);
  });

  test("evaluates runtime requests from JSON files", async () => {
    const bundlePath = await writeJson("bundle.json", cliBundle());
    const requestPath = await writeJson("request.json", {
      runId: "run_cli",
      stepId: "publish",
      tool: {
        name: "packages.publish",
        description: "Publish release artifacts.",
        risk: "critical"
      },
      input: {
        destination: "npm"
      },
      metadata: {
        purpose: "release"
      }
    });
    const stdout: string[] = [];

    const code = await runCli(["evaluate", bundlePath, requestPath], {
      stdout: (line) => stdout.push(line),
      stderr: () => undefined
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout.join("\n"))).toMatchObject({
      decision: "require_approval",
      approvalPrompt: "Review packages.publish for npm."
    });
  });

  test("prints digest only for digest command", async () => {
    const bundlePath = await writeJson("bundle.json", cliBundle());
    const stdout: string[] = [];

    const code = await runCli(["digest", bundlePath], {
      stdout: (line) => stdout.push(line),
      stderr: () => undefined
    });

    expect(code).toBe(0);
    expect(stdout).toHaveLength(1);
    expect(stdout[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("returns non-zero for invalid JSON policy files", async () => {
    const invalidPath = join(tempDir, "invalid.json");
    await writeFile(invalidPath, "{", "utf8");
    const stderr: string[] = [];

    const code = await runCli(["validate", invalidPath], {
      stdout: () => undefined,
      stderr: (line) => stderr.push(line)
    });

    expect(code).toBe(1);
    expect(stderr.join("\n")).toContain("Failed to read JSON");
  });

  test("keeps fixture policy valid for release gates", async () => {
    const fixture = JSON.parse(
      await readFile(new URL("../fixtures/enterprise-release-policy.json", import.meta.url), "utf8")
    );

    expect(fixture.schemaVersion).toBe("ajnas.policy.bundle.v1");
  });
});
