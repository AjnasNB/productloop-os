import { generateKeyPairSync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  BrowserResearchAuditLedger,
  ReplayBrowserAdapter,
  computeBrowserResearchPlanDigest,
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
    expect(verifyResearchProvenanceBundle({
      ...signed,
      signature: { ...signed.signature!, keyId: "tampered-release-key" }
    }, { publicKey })).toMatchObject({ valid: false });
    expect(verifyResearchProvenanceBundle({
      ...signed,
      signature: { ...signed.signature!, algorithm: "ecdsa-sha256" }
    }, { publicKey })).toMatchObject({ valid: false });
    expect(verifyResearchProvenanceBundle(signed)).toMatchObject({ valid: false, issues: [{ path: "$.signature" }] });
    expect(verifyResearchProvenanceBundle(bundle, { publicKey })).toMatchObject({ valid: false, issues: [{ path: "$.signature" }] });
    expect(verifyResearchProvenanceBundle({ ...bundle, signature: null } as never)).toMatchObject({ valid: false, issues: [{ path: "$.signature" }] });
    expect(verifyResearchProvenanceBundle({ ...signed, signature: { ...signed.signature!, algorithm: "unknown" as never } }, { publicKey })).toMatchObject({ valid: false });
    expect(verifyResearchProvenanceBundle({ ...signed, signature: { ...signed.signature!, value: "not-base64" } }, { publicKey })).toMatchObject({ valid: false });
    expect(verifyResearchProvenanceBundle(signed, { publicKey: "not-a-key" })).toMatchObject({ valid: false });

    const rsaPrivatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const rsaPublicPem = Buffer.from(publicKey.export({ type: "spki", format: "pem" }).toString());
    const signedFromSerializedKeys = signResearchProvenanceBundle(bundle, {
      privateKey: rsaPrivatePem,
      keyId: "serialized-rsa-key",
      algorithm: "rsa-sha256"
    });
    expect(verifyResearchProvenanceBundle(signedFromSerializedKeys, { publicKey: rsaPublicPem })).toEqual({ valid: true, issues: [] });

    const ed25519 = generateKeyPairSync("ed25519");
    const signedEd25519 = signResearchProvenanceBundle(bundle, {
      privateKey: ed25519.privateKey,
      keyId: "ed25519-key",
      algorithm: "ed25519"
    });
    expect(verifyResearchProvenanceBundle(signedEd25519, { publicKey: ed25519.publicKey })).toEqual({ valid: true, issues: [] });

    const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const signedEc = signResearchProvenanceBundle(bundle, {
      privateKey: ec.privateKey,
      keyId: "p256-key",
      algorithm: "ecdsa-sha256"
    });
    expect(verifyResearchProvenanceBundle(signedEc, { publicKey: ec.publicKey })).toEqual({ valid: true, issues: [] });
    expect(() => signResearchProvenanceBundle(bundle, {
      privateKey: ec.privateKey,
      keyId: "mismatched-ec-key",
      algorithm: "rsa-sha256"
    })).toThrow(/requires a rsa key/);
    expect(verifyResearchProvenanceBundle(signed, { publicKey: ec.publicKey })).toMatchObject({ valid: false });

    const rsaPss = generateKeyPairSync("rsa-pss", {
      modulusLength: 2048,
      hashAlgorithm: "sha256",
      mgf1HashAlgorithm: "sha256",
      saltLength: 32
    });
    const signedRsaPss = signResearchProvenanceBundle(bundle, {
      privateKey: rsaPss.privateKey,
      keyId: "rsa-pss-key",
      algorithm: "rsa-pss-sha256"
    });
    expect(verifyResearchProvenanceBundle(signedRsaPss, { publicKey: rsaPss.publicKey })).toEqual({ valid: true, issues: [] });
    expect(verifyResearchProvenanceBundle({
      ...signedRsaPss,
      signature: { ...signedRsaPss.signature!, algorithm: "rsa-sha256" }
    }, { publicKey: rsaPss.publicKey })).toMatchObject({ valid: false });
    expect(() => signResearchProvenanceBundle(bundle, {
      privateKey: rsaPss.privateKey,
      keyId: "rsa-pss-mislabeled",
      algorithm: "rsa-sha256"
    })).toThrow(/requires a rsa key/);

    let invoked = false;
    const accessorBundle = { ...bundle } as unknown as Record<string, unknown>;
    Object.defineProperty(accessorBundle, "digest", {
      enumerable: true,
      get() {
        invoked = true;
        return bundle.digest;
      }
    });
    expect(verifyResearchProvenanceBundle(accessorBundle as never)).toMatchObject({ valid: false, issues: [{ path: "$" }] });
    expect(invoked).toBe(false);
  });

  it("rejects foreign or malformed approval resolutions and stops before later steps", async () => {
    const plan = await loadFixture<BrowserResearchPlan>("release-browser-plan.json");
    const records = await loadFixture<ReplayBrowserAdapterRecord[]>("replay-adapter-records.json");
    const gatedPlan: BrowserResearchPlan = { ...plan, policy: { ...plan.policy, requireApprovalForActions: ["open"] } };
    const report = await runBrowserResearchPlan(gatedPlan, {
      adapter: new ReplayBrowserAdapter(records),
      approvalProvider: () => ({
        requestId: "approval_for_a_different_step",
        status: "approved",
        reviewer: "release-owner",
        decidedAt: "2026-07-13T12:45:30.000Z"
      }),
      now: fixedClock(),
      runId: "run_foreign_approval"
    });
    expect(report.status).toBe("awaiting_approval");
    expect(report.steps).toHaveLength(2);
    expect(report.steps.at(-1)?.error).toContain("requestId does not match");

    const malformed = await runBrowserResearchPlan(gatedPlan, {
      adapter: new ReplayBrowserAdapter(records),
      approvalProvider: (request) => ({ requestId: request.id, status: "approved", reviewer: " ", decidedAt: "not-a-date" }),
      now: fixedClock(),
      runId: "run_malformed_approval"
    });
    expect(malformed.status).toBe("awaiting_approval");
    expect(malformed.steps.at(-1)?.error).toMatch(/reviewer|decidedAt/);
  });

  it("snapshots the complete plan and detaches approval and adapter inputs across async mutation barriers", async () => {
    const plan: BrowserResearchPlan = {
      schema: "ajnas.browser.research.plan.v1",
      id: "immutable-release-plan",
      objective: "Keep approved browser input stable",
      policy: {
        allowedOrigins: ["https://safe.example"],
        requireApprovalForActions: ["open"]
      },
      steps: [
        {
          id: "approved-open",
          action: "open",
          purpose: "Open the approved public page",
          url: "https://safe.example/release"
        },
        {
          id: "stable-note",
          action: "note",
          purpose: "Record the original follow-up"
        }
      ]
    };
    const originalPlan = JSON.parse(JSON.stringify(plan)) as BrowserResearchPlan;
    let approvalEntered!: () => void;
    let releaseApproval!: () => void;
    const entered = new Promise<void>((resolve) => { approvalEntered = resolve; });
    const barrier = new Promise<void>((resolve) => { releaseApproval = resolve; });
    const adapterObservations: Array<{ stepId: string; url?: string; purpose: string }> = [];

    const run = runBrowserResearchPlan(plan, {
      runId: "run_immutable_release_plan",
      now: fixedClock(),
      approvalProvider: async (request) => {
        const internalRequestId = request.id;
        request.id = "provider-mutated-request-id";
        request.reason = "provider-mutated-reason";
        approvalEntered();
        await barrier;
        return {
          requestId: internalRequestId,
          status: "approved",
          reviewer: "release-owner",
          decidedAt: "2026-07-13T12:45:30.000Z"
        };
      },
      adapter: {
        open(input) {
          adapterObservations.push({ stepId: input.step.id, url: input.step.url, purpose: input.step.purpose });
          input.step.url = "https://adapter-mutated.example/";
          input.plan.steps[1]!.purpose = "adapter-mutated-follow-up";
          return { url: "https://safe.example/release", title: "Approved release", text: "approved evidence" };
        },
        note(input) {
          adapterObservations.push({ stepId: input.step.id, url: input.step.url, purpose: input.step.purpose });
          return { note: input.step.purpose };
        }
      }
    });

    await entered;
    plan.id = "caller-mutated-plan";
    plan.objective = "Caller changed the objective after approval began";
    plan.policy!.allowedOrigins = ["https://denied.example"];
    plan.steps[0]!.url = "https://denied.example/private";
    plan.steps[1]!.purpose = "caller-mutated-follow-up";
    releaseApproval();

    const report = await run;
    expect(report.status).toBe("passed");
    expect(report.planId).toBe("immutable-release-plan");
    expect(report.objective).toBe("Keep approved browser input stable");
    expect(report.planDigest).toBe(computeBrowserResearchPlanDigest(originalPlan));
    expect(report.steps[0]?.approvalRequest?.id).not.toBe("provider-mutated-request-id");
    expect(report.steps[0]?.approvalRequest?.reason).not.toBe("provider-mutated-reason");
    expect(adapterObservations).toEqual([
      {
        stepId: "approved-open",
        url: "https://safe.example/release",
        purpose: "Open the approved public page"
      },
      {
        stepId: "stable-note",
        purpose: "Record the original follow-up",
        url: undefined
      }
    ]);
    expect(verifyBrowserResearchReport(report)).toEqual({ valid: true, issues: [] });
  });

  it("rejects accessor-bearing plans without invoking their getters", async () => {
    let invoked = false;
    const plan = {
      schema: "ajnas.browser.research.plan.v1",
      id: "accessor-plan",
      steps: [{ id: "note", action: "note", purpose: "Do not invoke accessors" }]
    } as Record<string, unknown>;
    Object.defineProperty(plan, "objective", {
      enumerable: true,
      get() {
        invoked = true;
        return "unsafe accessor";
      }
    });

    await expect(runBrowserResearchPlan(plan, {
      adapter: { note: () => ({ note: "not reached" }) }
    })).rejects.toThrow(/enumerable data properties/);
    expect(invoked).toBe(false);
  });
});
