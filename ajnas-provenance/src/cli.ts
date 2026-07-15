import { readFile } from "node:fs/promises";
import { createTraceBundle, verifyTraceBundle } from "./bundle.js";
import { verifyTrace } from "./ledger.js";
import type { ProvenanceTraceEvent, TraceBundle } from "./types.js";

export interface CliIO {
  stdout?: { write(chunk: string): unknown };
  stderr?: { write(chunk: string): unknown };
}

export async function runCli(args: string[] = process.argv.slice(2), io: CliIO = {}): Promise<number> {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const [command, filePath] = args;

  if ((command !== "verify" && command !== "digest") || !filePath) {
    stderr.write("Usage: ajnas-provenance <verify|digest> <trace-or-bundle.json>\n");
    return 2;
  }

  const parsed = JSON.parse(await readFile(filePath, "utf8")) as TraceBundle | { events: ProvenanceTraceEvent[] };
  const bundle = isBundle(parsed)
    ? parsed
    : createTraceBundle(parsed.events, {
        generatedAt: "1970-01-01T00:00:00.000Z",
        generatedBy: "ajnas-provenance-cli",
        purpose: "cli-digest"
      });

  if (command === "digest") {
    stdout.write(`${bundle.digest}\n`);
    return 0;
  }

  const result = isBundle(parsed) ? verifyTraceBundle(bundle) : verifyTrace(parsed.events);
  if (!result.valid) {
    stderr.write(`invalid\n${result.issues.join("\n")}\n`);
    return 1;
  }
  stdout.write(`valid ${bundle.digest}\n`);
  return 0;
}

function isBundle(value: TraceBundle | { events: ProvenanceTraceEvent[] }): value is TraceBundle {
  return (value as TraceBundle).schemaVersion === "ajnas.provenance.bundle.v1";
}
