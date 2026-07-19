# ajnas-policy

`ajnas-policy` is a dependency-free declarative policy engine for Ajnas agent infrastructure. It turns versioned policy bundles into runtime-compatible `allow`, `deny`, and `require_approval` decisions, records replayable audit receipts, and provides a queue shape for human policy review workflows.

The package is designed for enterprise agent operations where tool execution, external publishing, provenance export, and connector use need explicit governance before a runtime action proceeds.

## Install

```bash
npm install ajnas-policy
```

## Runtime Use

```js
import { PolicyDecisionLedger, createDeclarativePolicyEngine } from "ajnas-policy";

const bundle = {
  schemaVersion: "ajnas.policy.bundle.v1",
  id: "com.example.release",
  version: "1.0.0",
  defaultEffect: "deny",
  rules: [
    {
      id: "review-npm-release",
      effect: "require_approval",
      reason: "external publishing requires release-owner approval",
      approvalPrompt: "Review {toolName} for {destination}.",
      match: {
        toolNames: ["packages.publish"],
        destinations: ["npm"]
      }
    }
  ]
};

const audit = new PolicyDecisionLedger();
const policy = createDeclarativePolicyEngine({ bundle, audit });

const decision = await policy.evaluate({
  runId: "run_1",
  stepId: "publish",
  tool: { name: "packages.publish", risk: "critical" },
  input: { destination: "npm", dataClasses: ["release-artifact"] },
  metadata: { purpose: "release" }
});
```

The returned decision matches the `ajnas-runtime` policy contract. The engine is directly assignable under strict TypeScript settings; no wrapper or type assertion is needed:

```ts
import { AgentRuntime } from "ajnas-runtime";
import { DeclarativePolicyEngine } from "ajnas-policy";

const runtime = new AgentRuntime({
  policy: new DeclarativePolicyEngine({ bundle })
});
```

The policy-side tool view intentionally contains only `name`, `description`, and `risk`. Tool execution remains owned by `ajnas-runtime` and is never exposed to policy code.

## Policy Bundles

A policy bundle uses schema version `ajnas.policy.bundle.v1` and contains ordered rules. Each rule has an effect, reason, optional approval prompt, priority, and match criteria.

Supported match criteria:

- `toolNames` and `toolNamePatterns`
- `risks`
- `purposes`
- `destinations`
- `dataClasses`
- `publishers`
- `capabilities`
- exact top-level `metadata` and `input` values

When multiple rules match, `deny` wins over `require_approval`, which wins over `allow`. Within the same effect, higher priority wins and bundle order breaks ties.

## Audit Receipts

`PolicyDecisionLedger` records each decision as an append-only event with a SHA-256 receipt chain. Each event stores the policy bundle id/version, run id, step id, tool name, selected rule, matched rules, request digest, and receipt.

Use `ledger.verify()` to replay the chain and detect tampering.

## Human Review

`PolicyApprovalQueue` serializes policy exceptions and review requests with stable ids, timestamps, status, reviewer resolution, and sanitized runtime request context. It is intentionally storage-neutral so teams can persist the JSON in files, queues, databases, or ticketing systems.

## CLI

```bash
ajnas-policy validate fixtures/enterprise-release-policy.json
ajnas-policy digest fixtures/enterprise-release-policy.json
ajnas-policy evaluate fixtures/enterprise-release-policy.json fixtures/publish-request.json
```

## Release Status

Version `0.1.3` is selected for the maintained Node 22/24/26 metadata and coordinated peer-floor patch. It is not a public release until the trusted workflow and registry verification succeed.
