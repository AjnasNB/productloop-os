import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));
const bin = fileURLToPath(new URL("../bin/ajnas-browser-research.js", import.meta.url));
const plan = fileURLToPath(new URL("../fixtures/release-browser-plan.json", import.meta.url));
const records = fileURLToPath(new URL("../fixtures/replay-adapter-records.json", import.meta.url));

describe("browser research CLI", () => {
  it("validates, digests, runs, verifies, and exports provenance", async () => {
    await execFileAsync("node", [bin, "validate", plan], { cwd: root });
    const digest = await execFileAsync("node", [bin, "digest", plan], { cwd: root });
    expect(digest.stdout.trim()).toMatch(/^sha256:/);

    const run = await execFileAsync("node", [bin, "run", plan, records], { cwd: root });
    const report = JSON.parse(run.stdout);
    expect(report.status).toBe("passed");

    const dir = await mkdtemp(join(tmpdir(), "ajnas-browser-research-"));
    try {
      const reportPath = join(dir, "report.json");
      await writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");
      const verification = await execFileAsync("node", [bin, "verify-report", reportPath], { cwd: root });
      expect(JSON.parse(verification.stdout)).toEqual({ valid: true, issues: [] });

      const provenance = await execFileAsync("node", [bin, "provenance", reportPath], { cwd: root });
      const bundle = JSON.parse(provenance.stdout);
      expect(bundle.reportDigest).toBe(report.digest);
      expect(bundle.digest).toMatch(/^sha256:/);
      expect(await readFile(reportPath, "utf8")).toContain(report.digest);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
