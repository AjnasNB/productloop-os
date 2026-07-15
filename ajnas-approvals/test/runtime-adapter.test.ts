import { describe, expect, test } from "vitest";
import { AgentRuntime, ApprovalRejectedError } from "../../ajnas-runtime/src/index.js";
import {
  ApprovalQueue,
  RuntimeApprovalPendingError,
  createRuntimeApprover,
  type ApprovalWorkflow,
  type RuntimeApprovalRequest
} from "../src/index.js";

const workflow: ApprovalWorkflow = {
  schemaVersion: "ajnas.approval.workflow.v1",
  id: "runtime-tool-approval",
  version: "1.0.0",
  name: "Runtime tool approval",
  owner: "runtime-governance",
  stages: [
    {
      id: "owner-review",
      name: "Owner review",
      reviewers: [{ id: "release-owner", kind: "role" }],
      quorum: { strategy: "any" }
    }
  ],
  policy: { requireReasonForRejection: true }
};

const request: RuntimeApprovalRequest = {
  runId: "run-approval",
  stepId: "publish",
  toolName: "npm.publish",
  risk: "critical",
  input: { packageName: "ajnas-example" },
  reason: "External publishing requires review.",
  prompt: "Approve this npm release?",
  metadata: {
    destinations: ["npm"],
    dataClasses: ["release-artifact"]
  },
  bindingDigest: "sha256:runtime-approval-test-binding"
};

describe("Ajnas runtime approver adapter", () => {
  test("returns an approved runtime response after the resolver completes the ticket", async () => {
    const queue = new ApprovalQueue({
      clock: () => new Date("2026-07-15T10:00:00.000Z")
    });
    const approver = createRuntimeApprover({
      queue,
      workflow,
      requestedBy: "release-bot",
      resolveTicket: (ticket) =>
        queue.review(ticket.id, workflow, {
          reviewerId: "release-owner",
          decision: "approve",
          comment: "Release checks passed."
        })
    });

    await expect(approver.requestApproval(request)).resolves.toEqual({
      approved: true,
      approverId: "release-owner",
      bindingDigest: request.bindingDigest,
      comment: "Release checks passed.",
      metadata: expect.objectContaining({
        approvalTicketStatus: "approved",
        approvalWorkflowId: workflow.id
      })
    });
  });

  test("returns a rejected runtime response for a rejected ticket", async () => {
    const queue = new ApprovalQueue({
      clock: () => new Date("2026-07-15T10:00:00.000Z")
    });
    const approver = createRuntimeApprover({
      queue,
      workflow,
      requestedBy: "release-bot",
      resolveTicket: (ticket) =>
        queue.review(ticket.id, workflow, {
          reviewerId: "release-owner",
          decision: "reject",
          comment: "Artifact digest is missing."
        })
    });

    await expect(approver.requestApproval(request)).resolves.toMatchObject({
      approved: false,
      approverId: "release-owner",
      comment: "Artifact digest is missing.",
      metadata: { approvalTicketStatus: "rejected" }
    });
  });

  test("throws a typed pending error rather than treating an unresolved ticket as rejection", async () => {
    const queue = new ApprovalQueue({
      clock: () => new Date("2026-07-15T10:00:00.000Z")
    });
    const approver = createRuntimeApprover({
      queue,
      workflow,
      requestedBy: "release-bot"
    });

    const pending = approver.requestApproval(request);
    await expect(pending).rejects.toBeInstanceOf(RuntimeApprovalPendingError);
    await expect(pending).rejects.toMatchObject({
      code: "AJNAS_APPROVAL_PENDING",
      status: "pending",
      stageId: "owner-review"
    });
    expect(queue.list({ status: "pending" })).toHaveLength(1);
  });

  test("plugs directly into AgentRuntime and preserves runtime rejection behavior", async () => {
    const queue = new ApprovalQueue({
      clock: () => new Date("2026-07-15T10:00:00.000Z")
    });
    const runtime = new AgentRuntime({
      tools: [
        {
          name: "npm.publish",
          description: "Publish a package to npm.",
          risk: "critical",
          execute: () => ({ published: true })
        }
      ],
      policy: {
        evaluate: () => ({
          decision: "require_approval",
          reason: "External publishing requires review."
        })
      },
      approver: createRuntimeApprover({
        queue,
        workflow,
        requestedBy: "release-bot",
        resolveTicket: (ticket) =>
          queue.review(ticket.id, workflow, {
            reviewerId: "release-owner",
            decision: "reject",
            comment: "Release is not ready."
          })
      }),
      runIdFactory: () => "run-runtime-adapter"
    });

    await expect(
      runtime.run({
        name: "publish",
        steps: [
          {
            id: "publish",
            run: (context) => context.callTool("npm.publish", { packageName: "ajnas-example" })
          }
        ]
      })
    ).rejects.toBeInstanceOf(ApprovalRejectedError);
  });
});
