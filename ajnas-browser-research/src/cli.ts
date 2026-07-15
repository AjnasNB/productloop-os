import { readFile } from "node:fs/promises";
import { ReplayBrowserAdapter } from "./adapter.js";
import { createResearchProvenanceBundle } from "./provenance.js";
import { runBrowserResearchPlan, verifyBrowserResearchReport } from "./harness.js";
import { computeBrowserResearchPlanDigest, validateBrowserResearchPlan } from "./validation.js";
import type { BrowserResearchReport, ReplayBrowserAdapterRecord } from "./types.js";

function usage(): string {
  return [
    "Usage:",
    "  ajnas-browser-research validate <plan.json>",
    "  ajnas-browser-research digest <plan.json>",
    "  ajnas-browser-research run <plan.json> <replay-records.json>",
    "  ajnas-browser-research verify-report <report.json>",
    "  ajnas-browser-research provenance <report.json>"
  ].join("\n");
}

function decodeJsonBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  const hasUtf16Nulls = buffer.length > 2 && buffer[1] === 0 && buffer[3] === 0;
  if (hasUtf16Nulls) {
    return buffer.toString("utf16le");
  }
  return buffer.toString("utf8").replace(/^\uFEFF/, "");
}

async function readJsonFile(path: string): Promise<unknown> {
  const buffer = await readFile(path);
  return JSON.parse(decodeJsonBuffer(buffer));
}

export async function runCli(argv: string[]): Promise<void> {
  const [command, first, second] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  if (command === "validate") {
    if (!first) {
      throw new Error(usage());
    }
    const plan = await readJsonFile(first);
    const result = validateBrowserResearchPlan(plan);
    console.log(JSON.stringify({ ...result, digest: result.valid ? computeBrowserResearchPlanDigest(plan) : undefined }, null, 2));
    if (!result.valid) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "digest") {
    if (!first) {
      throw new Error(usage());
    }
    const plan = await readJsonFile(first);
    const result = validateBrowserResearchPlan(plan);
    if (!result.valid) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(computeBrowserResearchPlanDigest(plan));
    return;
  }

  if (command === "run") {
    if (!first || !second) {
      throw new Error(usage());
    }
    const plan = await readJsonFile(first);
    const records = (await readJsonFile(second)) as ReplayBrowserAdapterRecord[];
    const report = await runBrowserResearchPlan(plan, {
      adapter: new ReplayBrowserAdapter(records)
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== "passed") {
      process.exitCode = 2;
    }
    return;
  }

  if (command === "verify-report") {
    if (!first) {
      throw new Error(usage());
    }
    const report = (await readJsonFile(first)) as BrowserResearchReport;
    const result = verifyBrowserResearchReport(report);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "provenance") {
    if (!first) {
      throw new Error(usage());
    }
    const report = (await readJsonFile(first)) as BrowserResearchReport;
    const verification = verifyBrowserResearchReport(report);
    if (!verification.valid) {
      console.error(JSON.stringify(verification, null, 2));
      process.exitCode = 1;
      return;
    }
    console.log(JSON.stringify(createResearchProvenanceBundle(report), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}\n${usage()}`);
}
