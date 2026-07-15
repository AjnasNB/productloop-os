import { describe, expect, test } from "vitest";
import {
  EvalAuditLedger,
  computeEvalSuiteDigest,
  runEvalSuite,
  validateEvalSuite,
  verifyEvalAuditTrail,
  verifyEvalReport
} from "../src/index.js";
import type { AgentRunArtifact, EvalSuite } from "../src/index.js";

const fixedClock = () => new Date("2026-07-09T06:30:00.000Z");

const releaseSuite: EvalSuite = {
  schemaVersion: "ajnas.eval.suite.v1",
  id: "suite_release_governance",
  version: "0.1.0",
  title: "Release governance regression suite",
  owner: "Ajnas",
  cases: [
    {
      id: "release_publish_gate",
      name: "package release waits for human approval with replayable evidence",
      risk: "critical",
      input: {
        packageName: "ajnas-policy",
        version: "0.1.0",
        destination: "npm"
      },
      assertions: [
        { id: "status", kind: "run.status", status: "waiting_for_approval" },
        { id: "package", kind: "json.path", path: "output.release.packageName", equals: "ajnas-policy" },
        { id: "tool-event", kind: "event.type.count", eventType: "tool.requested", min: 1 },
        { id: "policy", kind: "policy.decision", toolName: "npm.publish", decision: "require_approval" },
        { id: "approval", kind: "approval.status", toolName: "npm.publish", status: "pending" },
        { id: "trace", kind: "provenance.valid", valid: true },
        { id: "connector", kind: "connector.trust", connectorId: "npm", trustTier: "verified" },
        { id: "browser", kind: "browser.step", stepType: "inspect", urlHost: "npmjs.com", status: "passed" }
      ]
    }
  ],
  metadata: {
    product: "ajnas-evals"
  }
};

const releaseArtifact: AgentRunArtifact = {
  schemaVersion: "ajnas.run.artifact.v1",
  runId: "run_release_001",
  status: "waiting_for_approval",
  output: {
    release: {
      packageName: "ajnas-policy",
      version: "0.1.0",
      approvalGate: "waiting"
    }
  },
  events: [
    {
      sequence: 1,
      type: "run.started",
      timestamp: "2026-07-09T06:29:58.000Z",
      data: { workflow: "release-governance" }
    },
    {
      sequence: 2,
      type: "tool.requested",
      timestamp: "2026-07-09T06:29:59.000Z",
      data: { toolName: "npm.publish" }
    }
  ],
  policyDecisions: [
    {
      toolName: "npm.publish",
      decision: "require_approval",
      reason: "External publishing requires explicit approval",
      receiptHash: "policy_hash_001"
    }
  ],
  approvals: [
    {
      toolName: "npm.publish",
      status: "pending",
      requestedBy: "daily-oss-skill-and-crawler-research",
      reason: "Release approval gate"
    }
  ],
  provenance: {
    valid: true,
    rootHash: "root_hash_001",
    eventCount: 2
  },
  connectorCalls: [
    {
      connectorId: "npm",
      operation: "publish",
      trustTier: "verified",
      destination: "npm",
      dataClasses: ["public-package-metadata"]
    }
  ],
  browserSteps: [
    {
      stepId: "inspect_npm_package",
      type: "inspect",
      status: "passed",
      url: "https://www.npmjs.com/package/ajnas-policy"
    }
  ]
};

describe("ajnas eval suites", () => {
  test("validates eval suites and computes deterministic digests", () => {
    expect(validateEvalSuite(releaseSuite)).toEqual({ valid: true, issues: [] });

    const digest = computeEvalSuiteDigest(releaseSuite);

    expect(digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(computeEvalSuiteDigest({ ...releaseSuite })).toBe(digest);
  });

  test("runs agent artifacts through enterprise assertions and emits a verifiable report", async () => {
    const report = await runEvalSuite(releaseSuite, async (testCase) => {
      expect(testCase.id).toBe("release_publish_gate");
      return releaseArtifact;
    }, {
      generatedAt: fixedClock,
      generatedBy: "daily-oss-skill-and-crawler-research"
    });

    expect(report.summary).toEqual({
      totalCases: 1,
      passedCases: 1,
      failedCases: 0,
      totalAssertions: 8,
      passedAssertions: 8,
      failedAssertions: 0
    });
    expect(report.caseResults[0].status).toBe("passed");
    expect(report.caseResults[0].assertions.map((assertion) => assertion.status)).toEqual([
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed",
      "passed"
    ]);
    expect(verifyEvalReport(report)).toEqual({ valid: true, issues: [] });
  });

  test("records eval run receipts and detects tampering", async () => {
    const report = await runEvalSuite(releaseSuite, () => releaseArtifact, {
      generatedAt: fixedClock,
      generatedBy: "daily-oss-skill-and-crawler-research"
    });
    const ledger = new EvalAuditLedger({ clock: fixedClock });
    const event = ledger.record({
      actor: "daily-oss-skill-and-crawler-research",
      action: "eval.suite.completed",
      suite: releaseSuite,
      report
    });

    expect(event.sequence).toBe(1);
    expect(event.receipt.previousHash).toBeNull();
    expect(ledger.verify()).toEqual({ valid: true, issues: [] });

    const tampered = [{ ...event, action: "eval.suite.failed" as const }];

    expect(verifyEvalAuditTrail(tampered).valid).toBe(false);
  });

  test("reports assertion failures without throwing away the audit shape", async () => {
    const failedArtifact: AgentRunArtifact = {
      ...releaseArtifact,
      status: "completed",
      policyDecisions: []
    };

    const report = await runEvalSuite(releaseSuite, () => failedArtifact, {
      generatedAt: fixedClock,
      generatedBy: "daily-oss-skill-and-crawler-research"
    });

    expect(report.summary.failedCases).toBe(1);
    expect(report.caseResults[0].status).toBe("failed");
    expect(report.caseResults[0].assertions.filter((assertion) => assertion.status === "failed")).toHaveLength(2);
    expect(verifyEvalReport(report)).toEqual({ valid: true, issues: [] });
  });
});
