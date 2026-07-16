import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/eval-suite-v1.md",
  "docs/provenance-and-licenses.md",
  "docs/publish-checklist.md",
  "examples/basic-eval.mjs",
  "fixtures/release-eval-suite.json",
  "fixtures/release-run-artifacts.json",
  "bin/ajnas-evals.js"
];

describe("package readiness", () => {
  test("ships release documentation, fixtures, examples, and CLI entrypoint", () => {
    for (const filePath of requiredFiles) {
      expect(existsSync(filePath), `${filePath} should exist`).toBe(true);
    }
  });

  test("package metadata exposes only production release assets", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.name).toBe("ajnas-evals");
    expect(packageJson.version).toBe("0.1.1");
    expect(packageJson.bin).toEqual({ "ajnas-evals": "./bin/ajnas-evals.js" });
    expect(packageJson.files).toEqual(["bin", "dist", "README.md", "LICENSE", "CHANGELOG.md", "SECURITY.md", "docs", "examples", "fixtures"]);
    expect(packageJson.peerDependencies).toMatchObject({
      "ajnas-runtime": "^0.2.0",
      "ajnas-policy": "^0.1.1",
      "ajnas-provenance": "^0.1.2"
    });
  });
});
