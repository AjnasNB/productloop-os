import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  ApprovalAuditLedger,
  ApprovalQueue,
  computeApprovalTicketDigest,
  computeApprovalWorkflowDigest,
  createApprovalSubjectFromConnectorTrust,
  createApprovalSubjectFromPolicyDecision,
  createReleaseApprovalSubject,
  createRuntimeDecisionFromApprovalTicket,
  escalateApprovalTicket,
  expireApprovalTicket,
  validateApprovalSubject,
  validateApprovalWorkflow
} from "../src/index.js";
import type { ApprovalRequestDocument, ApprovalWorkflow } from "../src/index.js";

const workflow = JSON.parse(readFileSync("fixtures/release-approval.workflow.json", "utf8")) as ApprovalWorkflow;
const request = JSON.parse(readFileSync("fixtures/release-approval-request.json", "utf8")) as ApprovalRequestDocument;

describe("approval workflows", () => {
  test("validates workflow and release approval subjects", () => {
    const workflowResult = validateApprovalWorkflow(workflow);
    const subjectResult = validateApprovalSubject(request.subject);

    expect(workflowResult.valid).toBe(true);
    expect(subjectResult.valid).toBe(true);
    expect(computeApprovalWorkflowDigest(workflow)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  test("runs staged approval with delegation and replayable audit receipts", () => {
    const times = [
      "2026-07-12T09:00:00.000Z",
      "2026-07-12T09:01:00.000Z",
      "2026-07-12T09:02:00.000Z",
      "2026-07-12T09:03:00.000Z",
      "2026-07-12T09:04:00.000Z",
      "2026-07-12T09:05:00.000Z",
      "2026-07-12T09:06:00.000Z",
      "2026-07-12T09:07:00.000Z"
    ];
    let tick = 0;
    const clock = () => new Date(times[Math.min(tick++, times.length - 1)]);
    const audit = new ApprovalAuditLedger({ clock });
    const queue = new ApprovalQueue({ clock, audit });

    const ticket = queue.request({ workflow, ...request });
    expect(ticket.status).toBe("pending");
    expect(ticket.expiresAt).toBe("2026-07-14T09:00:00.000Z");
    expect(createRuntimeDecisionFromApprovalTicket(ticket).decision).toBe("require_approval");

    const stageTwo = queue.review(ticket.id, workflow, {
      reviewerId: "security-lead",
      decision: "approve",
      comment: "reviewed"
    });
    expect(stageTwo.stageId).toBe("release-owner-review");
    expect(stageTwo.status).toBe("pending");

    const delegated = queue.delegate(stageTwo.id, workflow, {
      fromReviewerId: "release-owner",
      toReviewer: { id: "backup-release-owner", kind: "role" },
      reason: "owner unavailable"
    });
    expect(delegated.delegations).toHaveLength(1);

    const afterCompliance = queue.review(delegated.id, workflow, {
      reviewerId: "compliance-reviewer",
      decision: "approve",
      comment: "compliance ok"
    });
    expect(afterCompliance.status).toBe("pending");

    const approved = queue.review(afterCompliance.id, workflow, {
      reviewerId: "backup-release-owner",
      decision: "approve",
      comment: "release ok"
    });
    expect(approved.status).toBe("approved");
    expect(createRuntimeDecisionFromApprovalTicket(approved).decision).toBe("allow");
    expect(computeApprovalTicketDigest(approved)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(audit.verify()).toEqual({ valid: true, issues: [] });
  });

  test("enforces self-approval, rejection reason, escalation, and expiry gates", () => {
    const queue = new ApprovalQueue({ clock: () => new Date("2026-07-12T09:00:00.000Z") });
    const ticket = queue.request({ workflow, ...request });

    expect(() =>
      queue.review(ticket.id, workflow, {
        reviewerId: "release-bot",
        decision: "approve"
      })
    ).toThrow(/not authorized|self-approval/);

    const stageTwo = queue.review(ticket.id, workflow, {
      reviewerId: "security-lead",
      decision: "approve",
      comment: "security ok",
      reviewedAt: "2026-07-12T10:00:00.000Z"
    });

    expect(() =>
      queue.review(stageTwo.id, workflow, {
        reviewerId: "release-owner",
        decision: "reject"
      })
    ).toThrow(/requires a reviewer comment/);

    const escalated = escalateApprovalTicket(workflow, stageTwo, "2026-07-13T11:00:00.000Z");
    expect(escalated.status).toBe("escalated");

    const expired = expireApprovalTicket(workflow, escalated, "2026-07-14T09:00:00.000Z");
    expect(expired.status).toBe("expired");
    expect(createRuntimeDecisionFromApprovalTicket(expired).decision).toBe("deny");
  });

  test("rejects malformed review decisions and identities without changing the ticket", () => {
    const queue = new ApprovalQueue({ clock: () => new Date("2026-07-12T09:00:00.000Z") });
    const ticket = queue.request({ workflow, ...request });
    expect(() => queue.review(ticket.id, workflow, { reviewerId: "security-lead", decision: "yes" } as never)).toThrow(/approve or reject/);
    expect(() => queue.review(ticket.id, workflow, { reviewerId: " ", decision: "approve" })).toThrow(/non-empty/);
    expect(queue.get(ticket.id)).toMatchObject({ status: "pending", decisions: [] });
  });

  test("validates request, delegation, and cancellation inputs before state changes", () => {
    const queue = new ApprovalQueue({ clock: () => new Date("2026-07-12T09:00:00.000Z") });
    expect(() => queue.request({ workflow, ...request, requestedBy: " " })).toThrow(/requestedBy/);
    expect(() => queue.request({ workflow, ...request, reason: "", metadata: "bad" as never })).toThrow(/reason|metadata/);
    expect(() => queue.request({ workflow, ...request, policyDecision: { decision: "maybe", reason: "bad" } as never })).toThrow(/policyDecision/);

    const ticket = queue.request({ workflow, ...request });
    const stageTwo = queue.review(ticket.id, workflow, { reviewerId: "security-lead", decision: "approve" });
    expect(() => queue.delegate(stageTwo.id, workflow, {
      fromReviewerId: "release-owner",
      toReviewer: { id: "backup", kind: "robot" } as never,
      reason: "delegate"
    })).toThrow(/kind/);
    expect(() => queue.delegate(stageTwo.id, workflow, {
      fromReviewerId: " ",
      toReviewer: { id: "backup", kind: "role" },
      reason: "delegate"
    })).toThrow(/fromReviewerId/);
    expect(() => queue.cancel(stageTwo.id, workflow, { actorId: "", reason: "cancel" })).toThrow(/actorId/);
    expect(() => queue.cancel(stageTwo.id, workflow, { actorId: "owner", reason: " ", metadata: [] as never })).toThrow(/reason|metadata/);
    expect(queue.get(stageTwo.id)).toMatchObject({ status: "pending", delegations: [] });
  });
});

describe("approval adapters", () => {
  test("creates approval subjects from policy, connector, and release contexts", () => {
    const policySubject = createApprovalSubjectFromPolicyDecision(
      {
        runId: "run-1",
        stepId: "step-1",
        tool: { name: "npm.publish", risk: "critical" },
        input: {},
        metadata: {
          destinations: ["npm"],
          dataClasses: ["release-artifact"]
        }
      },
      {
        decision: "require_approval",
        reason: "external publishing requires approval"
      }
    );
    const connectorSubject = createApprovalSubjectFromConnectorTrust({
      decision: "require_approval",
      connectorId: "com.ajnas.npm-publisher",
      risk: "critical",
      operation: "publish",
      destinations: ["npm"],
      dataClasses: ["release-artifact"],
      manifestDigest: "sha256:manifest"
    });
    const releaseSubject = createReleaseApprovalSubject({
      packageName: "ajnas-approvals",
      version: "0.1.0",
      changeSummary: "Initial release candidate.",
      artifactDigests: ["sha256:artifact"]
    });

    expect(policySubject.kind).toBe("runtime-tool");
    expect(connectorSubject.artifactDigests).toEqual(["sha256:manifest"]);
    expect(releaseSubject.requestedAction).toBe("package.publish");
  });
});
