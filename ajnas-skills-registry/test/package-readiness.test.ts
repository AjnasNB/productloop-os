import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url);

describe("package readiness", () => {
  it("selects the coordinated registry patch and matching runtime peer", async () => {
    await Promise.all([
      "README.md",
      "LICENSE",
      "CHANGELOG.md",
      "SECURITY.md",
      "docs/publish-checklist.md",
      "examples/basic-registry.mjs"
    ].map((file) => access(new URL(file, root))));

    const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
    expect(manifest.name).toBe("ajnas-skills-registry");
    expect(manifest.version).toBe("0.2.1");
    expect(manifest.peerDependencies).toEqual({ "ajnas-runtime": "^0.2.1" });
  });
});
