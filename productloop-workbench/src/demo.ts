import { runDeterministicDemo } from "productloop-os";
import { digestJson, normalizeJson } from "./stable-json.js";
import { WorkbenchStore } from "./store.js";
import type { JsonObject } from "./types.js";

export interface WorkbenchDemoResult {
  schemaVersion: "productloop.workbench.demo.v1";
  completedRunId: string;
  pendingRunId: string;
  pendingApprovalId: string;
  coreProof: Awaited<ReturnType<typeof runDeterministicDemo>>;
  reused: boolean;
}

export async function seedWorkbenchDemo(store: WorkbenchStore): Promise<WorkbenchDemoResult> {
  const coreProof = await runDeterministicDemo();
  const existingCompleted = store.getRun("run_workbench_proof");
  const existingPending = store.getRun("run_workbench_pending");
  if (existingCompleted && existingPending) {
    const approval = store.listApprovals(existingPending.id)[0];
    if (!approval) throw new Error("The existing Workbench demo is missing its approval fixture.");
    return {
      schemaVersion: "productloop.workbench.demo.v1",
      completedRunId: existingCompleted.id,
      pendingRunId: existingPending.id,
      pendingApprovalId: approval.id,
      coreProof,
      reused: true
    };
  }

  const completed = existingCompleted ?? store.createRun({
    id: "run_workbench_proof",
    title: "Verify the governed local stack",
    purpose: "Exercise policy, approval, provenance, browser replay, evaluation, Maqam evidence, and a cited memory boundary without network access or model keys.",
    risk: "low",
    status: "completed",
    policyDecision: "allow",
    policyReason: "The deterministic fixture uses only reviewed local adapters and performs no external side effect.",
    currentStep: "Proof bundle ready",
    context: { coreProof: normalizeJson(coreProof) as JsonObject }
  });
  if (!existingCompleted) {
    store.addEvidence({
      id: "ev_workbench_productloop",
      runId: completed.id,
      sourceType: "productloop",
      source: "productloop-os:deterministic-demo",
      title: "ProductLoop composition proof",
      excerpt: JSON.stringify(coreProof)
    });
    store.addEvidence({
      id: "ev_workbench_browser",
      runId: completed.id,
      sourceType: "cockroach-browser",
      source: "replay:example.com/evidence",
      title: "Browser evidence handoff",
      excerpt: "A deterministic browser-research replay produced a cited, provenance-valid report.",
      uri: "https://example.com/evidence"
    });
    store.addEvidence({
      id: "ev_workbench_crawler",
      runId: completed.id,
      sourceType: "cockroach-crawler",
      source: "fixture:public-source-record",
      title: "Bounded public source record",
      excerpt: "The no-key demo represents a bounded public read; it does not perform live crawling."
    });
    const memorySummary = "Qarinah may retain the cited proof outcome after explicit workspace consent; Workbench stores only this evidence-linked reference.";
    store.addMemoryLink({
      id: "mem_workbench_proof",
      runId: completed.id,
      provider: "qarinah",
      eventId: "evt_workbench_demo_outcome",
      eventHash: digestJson({ runId: completed.id, summary: memorySummary }),
      relationship: "outcome",
      summary: memorySummary
    });
  }

  const pending = existingPending ?? store.createRun({
    id: "run_workbench_pending",
    title: "Publish reviewed release notes",
    purpose: "Demonstrate that a consequential publish effect pauses before dispatch and exposes the exact canonical input for human review.",
    risk: "high",
    policyDecision: "require_approval",
    policyReason: "Publishing changes external state and requires an exact one-use approval.",
    currentStep: "Prepare exact publish proposal",
    context: {
      target: "example/release",
      release: "v0.1.0",
      boundary: "Fixture only; Workbench does not dispatch this operation."
    }
  });
  const pendingApproval = store.listApprovals(pending.id)[0] ?? store.requestApproval({
    id: "apr_workbench_publish",
    runId: pending.id,
    toolName: "release.publish",
    effect: "publish",
    risk: "high",
    reason: "The release target and artifact digest must be reviewed before a governed host may dispatch the publish tool.",
    requestedBy: "workbench-demo",
    input: {
      repository: "example/release",
      version: "v0.1.0",
      artifactDigest: digestJson({ fixture: "productloop-workbench", version: "0.1.0" })
    }
  });

  return {
    schemaVersion: "productloop.workbench.demo.v1",
    completedRunId: completed.id,
    pendingRunId: pending.id,
    pendingApprovalId: pendingApproval.id,
    coreProof,
    reused: false
  };
}
