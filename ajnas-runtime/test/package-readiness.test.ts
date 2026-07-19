import { access, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = new URL("..", import.meta.url);

describe("package readiness", () => {
  it("selects the coordinated runtime patch and ships its release files", async () => {
    await Promise.all([
      "README.md",
      "LICENSE",
      "CHANGELOG.md",
      "SECURITY.md",
      "docs/publish-checklist.md",
      "examples/basic-runtime.mjs"
    ].map((file) => access(new URL(file, root))));

    const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
    expect(manifest.name).toBe("ajnas-runtime");
    expect(manifest.version).toBe("0.2.2");
  });
});
