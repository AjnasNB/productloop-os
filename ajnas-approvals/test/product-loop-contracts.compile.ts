import { AgentRuntime } from "../../ajnas-runtime/dist/index.js";
import {
  DeclarativePolicyEngine,
  type PolicyBundle
} from "../../ajnas-policy/dist/index.js";
import { createProvenanceExportPolicy } from "../../ajnas-provenance/dist/index.js";
import {
  ApprovalQueue,
  createRuntimeApprover,
  type ApprovalWorkflow
} from "../dist/index.js";

const bundle: PolicyBundle = {
  schemaVersion: "ajnas.policy.bundle.v1",
  id: "consumer-contract",
  version: "1.0.0",
  defaultEffect: "allow",
  rules: []
};

const workflow: ApprovalWorkflow = {
  schemaVersion: "ajnas.approval.workflow.v1",
  id: "consumer-approval",
  version: "1.0.0",
  name: "Consumer approval",
  owner: "consumer",
  stages: [
    {
      id: "review",
      name: "Review",
      reviewers: [{ id: "owner", kind: "role" }],
      quorum: { strategy: "any" }
    }
  ]
};

const queue = new ApprovalQueue();

new AgentRuntime({
  policy: new DeclarativePolicyEngine({ bundle }),
  approver: createRuntimeApprover({
    queue,
    workflow,
    requestedBy: "runtime",
    resolveTicket: (ticket) =>
      queue.review(ticket.id, workflow, {
        reviewerId: "owner",
        decision: "approve"
      })
  })
});

new AgentRuntime({
  policy: createProvenanceExportPolicy({
    approvalDestinations: ["external"]
  })
});
