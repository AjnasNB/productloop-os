# Security

Request, review, delegation, and cancellation APIs validate identities, exact decisions, reasons, timestamps, and bounded JSON metadata before changing a ticket.

Canonical JSON normalization accepts only own enumerable data descriptors. Accessors and inherited descriptor fields are rejected without invoking getters, including when `Object.prototype` is polluted.

`ajnas-approvals` is a workflow state and evidence package. It does not authenticate users, deliver notifications, store secrets, or enforce organizational identity by itself.

## Required Host Responsibilities

- Authenticate reviewers before accepting review decisions.
- Map workflow reviewer ids to trusted user, group, or role identities.
- Persist tickets and audit events in tamper-resistant storage.
- Protect approval tickets that contain confidential release or incident metadata.
- Verify provenance, policy, and connector evidence before presenting a ticket for approval.
- Do not execute external publishing or high-risk actions until the resulting ticket is `approved`.

## Sensitive Data

Approval subjects can contain destinations, data classes, artifact digests, and metadata. Do not store secrets, access tokens, private customer data, or raw credentials in ticket metadata. Store secret references or redacted digests instead.

## Audit Receipts

`ApprovalAuditLedger.verify()` detects local hash-chain tampering. It does not replace signed storage, append-only databases, or external attestations. For release automation, persist the ledger and ticket snapshot alongside the policy and provenance evidence used to create the request.
