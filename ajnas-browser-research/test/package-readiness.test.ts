import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url);

async function read(relative: string): Promise<string> {
  return readFile(new URL(relative, root), "utf8");
}

describe("package readiness", () => {
  it("ships the release-critical documentation and fixtures", async () => {
    const required = [
      "README.md",
      "LICENSE",
      "CHANGELOG.md",
      "SECURITY.md",
      "docs/architecture.md",
      "docs/browser-research-plan-v1.md",
      "docs/provenance-and-licenses.md",
      "docs/publish-checklist.md",
      "examples/basic-browser-research.mjs",
      "fixtures/release-browser-plan.json",
      "fixtures/replay-adapter-records.json"
    ];

    await Promise.all(required.map((file) => access(new URL(file, root))));

    expect(await read("README.md")).toContain("approval");
    expect(await read("SECURITY.md")).toContain("robots.txt");
    expect(await read("docs/provenance-and-licenses.md")).toContain("No third-party implementation code");
    const manifest = JSON.parse(await read("package.json"));
    expect(manifest.version).toBe("0.1.2");
    expect(manifest.peerDependencies).toEqual({
      "ajnas-runtime": "^0.2.0",
      "ajnas-policy": "^0.1.1",
      "ajnas-provenance": "^0.1.2",
      "ajnas-connectors": "^0.1.1",
      "ajnas-approvals": "^0.1.1"
    });
    expect(await read("CHANGELOG.md")).toContain("## 0.1.2 - 2026-07-15");
  });
});
