import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TraceLedger, createTraceBundle, runCli } from "../src/index.js";

function memoryWriter() {
  let output = "";
  return {
    stream: {
      write(chunk: string) {
        output += chunk;
        return true;
      }
    },
    output() {
      return output;
    }
  };
}

describe("runCli", () => {
  it("verifies a trace bundle file and prints its deterministic digest", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "ajnas-provenance-"));
    try {
      const ledger = new TraceLedger({
        traceId: "trace_cli",
        clock: () => new Date("2026-07-06T06:10:00.000Z")
      });
      ledger.record({
        actor: "release",
        action: "bundle.created",
        subject: { type: "package", id: "ajnas-provenance@0.1.0" },
        source: { system: "ajnas-provenance", id: "cli-test" },
        data: { status: "candidate" }
      });
      const bundle = createTraceBundle(ledger.events, {
        generatedAt: "2026-07-06T06:11:00.000Z",
        generatedBy: "test",
        purpose: "cli-test"
      });
      const bundlePath = join(tempDir, "bundle.json");
      await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

      const stdout = memoryWriter();
      const stderr = memoryWriter();

      const exitCode = await runCli(["verify", bundlePath], {
        stdout: stdout.stream,
        stderr: stderr.stream
      });

      expect(exitCode).toBe(0);
      expect(stdout.output()).toBe(`valid ${bundle.digest}\n`);
      expect(stderr.output()).toBe("");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
