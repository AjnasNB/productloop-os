import { readFile } from "node:fs/promises";
import {
  ApprovalAuditLedger,
  ApprovalQueue,
  computeApprovalTicketDigest,
  createRuntimeDecisionFromApprovalTicket
} from "../dist/index.js";

const workflow = JSON.parse(await readFile(new URL("../fixtures/release-approval.workflow.json", import.meta.url), "utf8"));
const request = JSON.parse(await readFile(new URL("../fixtures/release-approval-request.json", import.meta.url), "utf8"));

const times = [
  "2026-07-12T09:00:00.000Z",
  "2026-07-12T09:01:00.000Z",
  "2026-07-12T09:02:00.000Z",
  "2026-07-12T09:03:00.000Z",
  "2026-07-12T09:04:00.000Z",
  "2026-07-12T09:05:00.000Z"
];
let tick = 0;
const clock = () => new Date(times[Math.min(tick++, times.length - 1)]);

const audit = new ApprovalAuditLedger({ clock });
const approvals = new ApprovalQueue({ clock, audit });

const requested = approvals.request({ workflow, ...request });
const securityReviewed = approvals.review(requested.id, workflow, {
  reviewerId: "security-lead",
  decision: "approve",
  comment: "Security evidence and provenance bundle are present."
});
const delegated = approvals.delegate(securityReviewed.id, workflow, {
  fromReviewerId: "release-owner",
  toReviewer: {
    id: "backup-release-owner",
    kind: "role",
    displayName: "Backup release owner"
  },
  reason: "Primary owner delegated release artifact review."
});
const complianceReviewed = approvals.review(delegated.id, workflow, {
  reviewerId: "compliance-reviewer",
  decision: "approve",
  comment: "Publish checklist is complete."
});
const approved = approvals.review(complianceReviewed.id, workflow, {
  reviewerId: "backup-release-owner",
  decision: "approve",
  comment: "Release artifacts are ready for approval-gated publish."
});

console.log(
  JSON.stringify(
    {
      status: approved.status,
      stageId: approved.stageId,
      runtimeDecision: createRuntimeDecisionFromApprovalTicket(approved).decision,
      ticketDigest: computeApprovalTicketDigest(approved),
      auditValid: audit.verify().valid
    },
    null,
    2
  )
);
