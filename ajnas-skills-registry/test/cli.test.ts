import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runCli } from "../src/cli.js";
import type { SkillManifest } from "../src/index.js";

function manifest(overrides: Partial<SkillManifest> = {}): SkillManifest {
  return {
    schemaVersion: "ajnas.skill.v1",
    id: "com.ajnas.cli-check",
    name: "CLI Check",
    version: "1.0.0",
    description: "Fixture used to validate the CLI behavior.",
    license: "Apache-2.0",
    entrypoint: {
      type: "module",
      value: "./dist/cli-check.js"
    },
    compatibility: {
      ajnasRuntime: "^0.2.1"
    },
    capabilities: [
      {
        name: "cli.check",
        description: "Validate CLI command behavior.",
        risk: "low"
      }
    ],
    permissions: {
      network: "none",
      filesystem: "none",
      externalPublish: false,
      humanApproval: "never"
    },
    trust: {
      source: "first-party",
      publisher: "ajnas",
      repository: "https://github.com/ajnas/examples",
      licenseEvidence: {
        kind: "repository",
        checkedAt: "2026-07-05T02:00:00.000Z"
      }
    },
    ...overrides
  };
}

describe("CLI", () => {
  test("validates a manifest and prints its digest", async () => {
    const file = await writeManifest(manifest());
    const output: string[] = [];

    const exitCode = await runCli(["validate", file], {
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    });

    expect(exitCode).toBe(0);
    expect(output.join("\n")).toContain("valid: true");
    expect(output.join("\n")).toMatch(/digest: sha256:[a-f0-9]{64}/);
  });

  test("returns a failing exit code and issue list for invalid manifests", async () => {
    const file = await writeManifest(manifest({ license: "BUSL-1.1" }));
    const output: string[] = [];

    const exitCode = await runCli(["validate", file], {
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    });

    expect(exitCode).toBe(1);
    expect(output.join("\n")).toContain("license.not_permissive");
  });

  test("prints only the digest for digest command", async () => {
    const file = await writeManifest(manifest());
    const output: string[] = [];

    const exitCode = await runCli(["digest", file], {
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line)
    });

    expect(exitCode).toBe(0);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

async function writeManifest(value: SkillManifest): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ajnas-skills-cli-"));
  const file = join(dir, "skill.json");
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
  return file;
}
