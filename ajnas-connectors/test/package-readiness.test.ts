import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/connector-manifest-v1.md",
  "docs/provenance-and-licenses.md",
  "docs/publish-checklist.md",
  "examples/basic-connectors.mjs",
  "fixtures/enterprise-release-publisher.connector.json",
  "fixtures/publish-invocation.json",
  "bin/ajnas-connectors.js"
];

describe("package readiness", () => {
  test("ships release documentation, fixtures, examples, and CLI entrypoint", () => {
    for (const filePath of requiredFiles) {
      expect(existsSync(filePath), `${filePath} should exist`).toBe(true);
    }
  });

  test("package metadata exposes only production release assets", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.name).toBe("ajnas-connectors");
    expect(packageJson.bin).toEqual({ "ajnas-connectors": "bin/ajnas-connectors.js" });
    expect(packageJson.files).toEqual(["bin", "dist", "README.md", "LICENSE", "CHANGELOG.md", "SECURITY.md", "docs", "examples", "fixtures"]);
    expect(packageJson.peerDependencies).toMatchObject({
      "ajnas-runtime": "^0.2.0",
      "ajnas-policy": "^0.1.1",
      "ajnas-provenance": "^0.1.2"
    });
  });
});
