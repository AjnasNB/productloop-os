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
    expect(await read("CHANGELOG.md")).toContain("0.1.0");
  });
});
