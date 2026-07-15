import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  BrowserResearchAuditLedger,
  ReplayBrowserAdapter,
  createResearchProvenanceBundle,
  runBrowserResearchPlan,
  signResearchProvenanceBundle,
  validateBrowserResearchPlan,
  verifyBrowserResearchReport,
  verifyResearchProvenanceBundle
} from "../src/index.js";
import type { BrowserResearchPlan, ReplayBrowserAdapterRecord } from "../src/index.js";

async function loadFixture<T>(name: string): Promise<T> {
  const value = await readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
  return JSON.parse(value) as T;
}

function fixedClock(): () => string {
  const values = [
    "2026-07-13T12:45:01.000Z",
    "2026-07-13T12:45:02.000Z",
    "2026-07-13T12:45:03.000Z",
    "2026-07-13T12:45:04.000Z",
    "2026-07-13T12:45:05.000Z",
    "2026-07-13T12:45:06.000Z",
    "2026-07-13T12:45:07.000Z",
    "2026-07-13T12:45:08.000Z",
    "2026-07-13T12:45:09.000Z",
    "2026-07-13T12:45:10.000Z",
    "2026-07-13T12:45:11.000Z",
    "2026-07-13T12:45:12.000Z",
    "2026-07-13T12:45:13.000Z",
    "2026-07-13T12:45:14.000Z"
  ];
  return () => values.shift() ?? "2026-07-13T12:45:59.000Z";
}

describe("browser research harness", () => {
  it("validates and runs the replayable release plan with citations and audit receipts", async () => {
    const plan = await loadFixture<BrowserResearchPlan>("release-browser-plan.json");
    const records = await loadFixture<ReplayBrowserAdapterRecord[]>("replay-adapter-records.json");
    const now = fixedClock();

    expect(validateBrowserResearchPlan(plan).valid).toBe(true);

    const report = await runBrowserResearchPlan(plan, {
      adapter: new ReplayBrowserAdapter(records),
      auditLedger: new BrowserResearchAuditLedger({ now }),
      now,
      runId: "run_release_browser_research_fixture"
    });

    expect(report.status).toBe("passed");
    expect(report.summary.stepsRun).toBe(4);
    expect(report.summary.citationsCaptured).toBeGreaterThanOrEqual(8);
    expect(report.steps.every((step) => step.outputDigest?.startsWith("sha256:"))).toBe(true);
    expect(report.audit.length).toBe(10);
    expect(verifyBrowserResearchReport(report)).toEqual({ valid: true, issues: [] });
  });

  it("fails closed when policy requires approval and no approval provider resolves the gate", async () => {
    const plan = await loadFixture<BrowserResearchPlan>("release-browser-plan.json");
    const records = await loadFixture<ReplayBrowserAdapterRecord[]>("replay-adapter-records.json");
    const gatedPlan: BrowserResearchPlan = {
      ...plan,
      policy: {
        ...plan.policy,
        requireApprovalForActions: ["open"]
      }
    };
    const now = fixedClock();

    const report = await runBrowserResearchPlan(gatedPlan, {
      adapter: new ReplayBrowserAdapter(records),
      auditLedger: new BrowserResearchAuditLedger({ now }),
      now,
      runId: "run_approval_required"
    });

    expect(report.status).toBe("awaiting_approval");
    expect(report.steps.at(-1)?.approvalRequest?.status).toBe("pending");
    expect(report.summary.approvalRequests).toBe(1);
  });

  it("continues an approved browser step and exports signed provenance", async () => {
    const plan = await loadFixture<BrowserResearchPlan>("release-browser-plan.json");
    const records = await loadFixture<ReplayBrowserAdapterRecord[]>("replay-adapter-records.json");
    const gatedPlan: BrowserResearchPlan = {
      ...plan,
      policy: {
        ...plan.policy,
        requireApprovalForActions: ["open"]
      }
    };
    const now = fixedClock();

    const report = await runBrowserResearchPlan(gatedPlan, {
      adapter: new ReplayBrowserAdapter(records),
      auditLedger: new BrowserResearchAuditLedger({ now }),
      approvalProvider: (request) => ({
        requestId: request.id,
        status: "approved",
        reviewer: "release-owner",
        decidedAt: "2026-07-13T12:45:30.000Z",
        reason: "release fixture is restricted to public npm metadata"
      }),
      now,
      runId: "run_approval_granted"
    });

    expect(report.status).toBe("passed");
    expect(report.summary.approvalRequests).toBe(1);

    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const bundle = createResearchProvenanceBundle(report, { generatedAt: "2026-07-13T12:46:00.000Z" });
    const signed = signResearchProvenanceBundle(bundle, {
      privateKey,
      keyId: "release-test-key"
    });

    expect(signed.signature?.value).toBeTruthy();
    expect(verifyResearchProvenanceBundle(signed, { publicKey })).toEqual({ valid: true, issues: [] });
  });
});
