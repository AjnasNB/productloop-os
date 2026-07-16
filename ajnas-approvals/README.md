# ajnas-approvals

`ajnas-approvals` is a human approval workflow SDK for Ajnas enterprise agent infrastructure. It turns high-risk runtime, policy, connector, provenance, and package release decisions into deterministic approval tickets with staged review, quorum rules, delegation, expiry, escalation, runtime policy decisions, and replayable audit receipts.

The package is intentionally transport-neutral. It does not send email, open tickets in a vendor system, or publish artifacts. Host systems can persist tickets in a database, route notifications through their own channels, and use this package to keep the approval state machine and evidence format consistent.

## Install

```sh
npm install ajnas-approvals
```

Node.js 20 or newer is required.

## Basic Usage

```js
import {
  ApprovalAuditLedger,
  ApprovalQueue,
  createReleaseApprovalSubject,
  createRuntimeDecisionFromApprovalTicket
} from "ajnas-approvals";

const workflow = {
  schemaVersion: "ajnas.approval.workflow.v1",
  id: "release-approval",
  version: "1.0.0",
  name: "Release approval",
  owner: "release-governance",
  stages: [
    {
      id: "owner-review",
      name: "Owner review",
      reviewers: [{ id: "release-owner", kind: "role" }],
      quorum: { strategy: "any" }
    }
  ],
  policy: { preventRequesterSelfApproval: true, defaultTtlHours: 48 }
};

const audit = new ApprovalAuditLedger();
const approvals = new ApprovalQueue({ audit });
const ticket = approvals.request({
  workflow,
  subject: createReleaseApprovalSubject({
    packageName: "ajnas-approvals",
    version: "0.1.0",
    changeSummary: "Initial approval workflow release."
  }),
  requestedBy: "release-bot",
  reason: "External publishing requires explicit approval."
});

const approved = approvals.review(ticket.id, workflow, {
  reviewerId: "release-owner",
  decision: "approve",
  comment: "Release checklist is complete."
});

console.log(createRuntimeDecisionFromApprovalTicket(approved));
console.log(audit.verify());
```

## `ajnas-runtime` Approver Adapter

`createRuntimeApprover` implements the structural `Approver` contract exported by `ajnas-runtime`. It adds no runtime dependency and can be passed to `AgentRuntime` without a wrapper or type assertion.

```ts
import { AgentRuntime } from "ajnas-runtime";
import { ApprovalQueue, createRuntimeApprover } from "ajnas-approvals";

const queue = new ApprovalQueue();
const approver = createRuntimeApprover({
  queue,
  workflow,
  requestedBy: "release-bot",
  resolveTicket: async (ticket) => {
    // A real host can wait for its database, webhook, or review UI here.
    return queue.review(ticket.id, workflow, {
      reviewerId: "release-owner",
      decision: "approve",
      comment: "Release checks passed."
    });
  }
});

const runtime = new AgentRuntime({ tools, policy, approver });
```

Adapter status behavior is explicit:

- `approved` becomes `{ approved: true, approverId, comment, metadata, bindingDigest }`.
- `rejected`, `expired`, and `cancelled` become `{ approved: false, bindingDigest, ... }`; `AgentRuntime` then raises its normal `ApprovalRejectedError`.
- `pending` and `escalated` raise `RuntimeApprovalPendingError` with code `AJNAS_APPROVAL_PENDING`, the ticket id, status, and stage. An unresolved ticket is never silently converted to a rejection.

The adapter binds the ticket subject to the runtime request and exactly echoes the runtime-supplied `bindingDigest`. `AgentRuntime` rejects a missing or mismatched digest, so a decision cannot be replayed for different tool input or policy context.

If `resolveTicket` is omitted, the ticket remains in the queue and the adapter raises the pending error immediately. A durable host should use `resolveTicket` to wait for or load the terminal ticket. Runtime request metadata is normalized into the ticket, but the raw tool input is not persisted by default; use `createSubject` or the adapter `metadata` option to attach a deliberately sanitized review payload.

## CLI

```sh
ajnas-approvals validate fixtures/release-approval.workflow.json
ajnas-approvals digest fixtures/release-approval.workflow.json
ajnas-approvals request fixtures/release-approval.workflow.json fixtures/release-approval-request.json
ajnas-approvals review fixtures/release-approval.workflow.json ticket.json approve security-lead "reviewed"
ajnas-approvals inspect ticket.json
```

The CLI reads UTF-8 JSON and UTF-16LE JSON produced by Windows PowerShell redirection.

## Workflow Model

- `ApprovalWorkflow` defines stages, reviewers, quorum, escalation, and workflow policy.
- `ApprovalSubject` describes the action under review: runtime tool, connector invocation, package release, policy exception, provenance export, or a custom subject.
- `ApprovalTicket` is a serializable review record with deterministic workflow digest, history, decisions, delegations, expiry, and current status.
- `ApprovalAuditLedger` records hash-chained receipts for requested, reviewed, delegated, escalated, expired, cancelled, and snapshot-exported events.

## Enterprise Controls

- Prevent requester self-approval.
- Require rejection comments.
- Limit delegation depth.
- Restrict allowed risk levels.
- Track sensitive data classes and artifact digests.
- Escalate overdue stages.
- Expire stale approval tickets.
- Convert ticket state back into runtime-compatible `allow`, `deny`, or `require_approval` decisions.
- Resolve runtime approval requests through the dependency-free `createRuntimeApprover` adapter.

## Local Development

```bash
npm test
npm run typecheck
npm run build
./node_modules/.bin/tsc -p test/tsconfig.contracts.json
```

The final command strictly compiles a consumer fixture that wires `ajnas-runtime` to `ajnas-policy`, `ajnas-provenance`, and `ajnas-approvals` directly.

## Release Status

Version `0.1.1` is the current public release with request-bound, terminal approval decisions and strict review validation.
