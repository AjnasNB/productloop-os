import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/policy-bundle-v1.md",
  "docs/provenance-and-licenses.md",
  "docs/publish-checklist.md",
  "examples/basic-policy.mjs",
  "fixtures/enterprise-release-policy.json",
  "fixtures/publish-request.json",
  "bin/ajnas-policy.js"
];

describe("package readiness", () => {
  test("ships release documentation, fixtures, examples, and CLI entrypoint", () => {
    for (const filePath of requiredFiles) {
      expect(existsSync(filePath), `${filePath} should exist`).toBe(true);
    }
  });

  test("package metadata exposes only production release assets", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.name).toBe("ajnas-policy");
    expect(packageJson.bin).toEqual({ "ajnas-policy": "./bin/ajnas-policy.js" });
    expect(packageJson.files).toEqual(["bin", "dist", "README.md", "LICENSE", "CHANGELOG.md", "SECURITY.md", "docs", "examples", "fixtures"]);
    expect(packageJson.peerDependencies).toMatchObject({
      "ajnas-runtime": "^0.1.0",
      "ajnas-provenance": "^0.1.0"
    });
  });
});
