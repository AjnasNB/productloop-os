# Architecture

`ajnas-approvals` is organized around deterministic review records:

- `types.ts` defines workflow, ticket, audit, runtime policy, and connector trust contracts.
- `validation.ts` validates `ajnas.approval.workflow.v1` workflows and approval subjects, then computes stable SHA-256 digests.
- `workflow.ts` implements pure ticket transitions: request, review, delegate, escalate, expire, cancel, summarize, and digest.
- `queue.ts` provides a small in-memory facade for host systems that want a convenient API before persisting tickets elsewhere.
- `audit.ts` records replayable hash-chained receipts for approval events.
- `adapters.ts` converts runtime policy decisions, connector trust evaluations, and package release intents into approval subjects.
- `runtime-adapter.ts` implements the dependency-free `ajnas-runtime` `Approver` shape, opens a ticket, delegates waiting/loading to a host resolver, maps terminal tickets to runtime responses, and raises a typed error while a ticket is unresolved.
- `cli.ts` exposes JSON-first workflow commands for CI and local release review.

## State Model

The ticket is the source of truth. Every transition returns a new serializable ticket shape with updated status, stage, decisions, delegations, and history. Host systems can store the returned ticket in any database or object store.

## Review Flow

1. Validate the workflow and approval subject.
2. Create a ticket with a deterministic id derived from workflow digest, subject digest, requester, reason, and timestamp.
3. Reviewers approve or reject the current stage.
4. Rejection ends the ticket immediately.
5. Approval advances to the next stage when quorum is satisfied.
6. The final stage moves the ticket to `approved`.
7. Overdue stages can be escalated, and stale tickets can expire.
8. Runtime hosts convert ticket status into `allow`, `deny`, or `require_approval`, or use `createRuntimeApprover` to bridge the queue directly into `AgentRuntime`.

The runtime bridge deliberately distinguishes workflow states: approved tickets continue execution; rejected, expired, and cancelled tickets return a negative approval response; pending and escalated tickets raise `RuntimeApprovalPendingError`. Hosts that support asynchronous human review provide `resolveTicket` to wait for or reload the terminal ticket.

## Audit Flow

`ApprovalAuditLedger` stores each event with:

- event sequence
- ticket identity
- workflow identity
- subject identity
- actor identity
- ticket digest
- previous event hash
- canonical JSON
- current event hash

This makes local approval evidence replayable and suitable for export into `ajnas-provenance` bundles.
