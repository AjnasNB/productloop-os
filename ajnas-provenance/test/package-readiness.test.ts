import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "SECURITY.md",
  "docs/architecture.md",
  "docs/provenance-and-licenses.md",
  "docs/publish-checklist.md",
  "docs/trace-bundle-v1.md",
  "examples/basic-provenance.mjs",
  "fixtures/release-gate.bundle.json"
];

describe("package readiness", () => {
  it("ships release documentation, example workflow, and a replayable fixture", async () => {
    await Promise.all(requiredFiles.map((file) => access(join(root, file))));

    const readme = await readFile(join(root, "README.md"), "utf8");
    expect(readme).toContain("TraceLedger");
    expect(readme).toContain("approval");
    expect(readme).toContain("ajnas-provenance verify");

    const licenseAudit = await readFile(join(root, "docs/provenance-and-licenses.md"), "utf8");
    expect(licenseAudit).toContain("@sigstore/core");
    expect(licenseAudit).toContain("@sigstore/sign");
    expect(licenseAudit).toContain("No third-party implementation code was copied");

    const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    expect(manifest.version).toBe("0.1.4");
    expect(manifest.peerDependencies).toEqual({
      "ajnas-runtime": "^0.2.2",
      "ajnas-skills-registry": "^0.2.2"
    });

    const fixture = JSON.parse(await readFile(join(root, "fixtures/release-gate.bundle.json"), "utf8"));
    expect(fixture.schemaVersion).toBe("ajnas.provenance.bundle.v1");
    expect(fixture.events.length).toBeGreaterThan(0);
    expect(fixture.digest.startsWith("sha256:")).toBe(true);
  });
});
