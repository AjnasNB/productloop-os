import { describe, expect, test } from "vitest";
import { runCli } from "../src/index.js";

const manifestPath = "fixtures/enterprise-release-publisher.connector.json";
const invocationPath = "fixtures/publish-invocation.json";

function createIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line)
    }
  };
}

describe("ajnas-connectors CLI", () => {
  test("validates and digests connector manifests", async () => {
    const validateIo = createIo();
    const validateCode = await runCli(["validate", manifestPath], validateIo.io);
    const digestIo = createIo();
    const digestCode = await runCli(["digest", manifestPath], digestIo.io);

    expect(validateCode).toBe(0);
    expect(validateIo.stdout[0]).toBe("valid: true");
    expect(validateIo.stdout[1]).toMatch(/^digest: sha256:[a-f0-9]{64}$/);
    expect(digestCode).toBe(0);
    expect(digestIo.stdout[0]).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("prints trust evaluations and runtime policy context", async () => {
    const trustIo = createIo();
    const trustCode = await runCli(["trust", manifestPath], trustIo.io);
    const policyIo = createIo();
    const policyCode = await runCli(["policy-context", manifestPath, invocationPath], policyIo.io);

    const trust = JSON.parse(trustIo.stdout.join("\n")) as { decision: string };
    const policyContext = JSON.parse(policyIo.stdout.join("\n")) as { tool: { name: string } };

    expect(trustCode).toBe(0);
    expect(trust.decision).toBe("require_approval");
    expect(policyCode).toBe(0);
    expect(policyContext.tool.name).toBe("connector:com.ajnas.connectors.release-publisher:npm.publish.approved:publish");
  });

  test("summarizes connector registries", async () => {
    const summaryIo = createIo();
    const code = await runCli(["registry-summary", manifestPath], summaryIo.io);
    const summary = JSON.parse(summaryIo.stdout.join("\n")) as Array<{ id: string; capabilities: string[] }>;

    expect(code).toBe(0);
    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      id: "com.ajnas.connectors.release-publisher",
      capabilities: ["npm.publish.dry-run", "npm.publish.approved", "github.release.notes"]
    });
  });

  test("returns non-zero for missing arguments", async () => {
    const missingIo = createIo();
    const code = await runCli(["policy-context", manifestPath], missingIo.io);

    expect(code).toBe(1);
    expect(missingIo.stderr[0]).toContain("Usage: ajnas-connectors policy-context");
  });
});
