# ajnas-runtime

Policy-gated agent workflow runtime with provenance receipts and human approval checkpoints.

`ajnas-runtime` is the foundation package for the Ajnas enterprise agent framework. It gives an agent workflow a small, auditable execution kernel:

- tools are registered through explicit contracts
- every tool call is evaluated by a policy engine
- high-risk calls can require a human approval response
- every run emits chained provenance receipts
- optional file-backed snapshots make runs resumable/auditable by downstream systems

The package is original Ajnas implementation work. It was shaped by public OSS research, but it does not vendor or copy third-party source code, examples, docs, or branding.

## Install

```bash
npm install ajnas-runtime
```

## Quick Start

```ts
import {
  AgentRuntime,
  FileRunStore,
  InMemoryProvenanceSink,
  ToolRegistry
} from "ajnas-runtime";

const tools = new ToolRegistry().register({
  name: "research.search",
  description: "Search trusted public sources.",
  risk: "low",
  execute: async ({ input }) => ({ summary: `found sources for ${input.query}` })
});

const runtime = new AgentRuntime({
  tools,
  provenance: new InMemoryProvenanceSink(),
  store: new FileRunStore({ directory: ".ajnas-runs" }),
  policy: {
    evaluate: async ({ tool }) => ({
      decision: tool.risk === "critical" ? "require_approval" : "allow",
      reason: "default release-safety policy"
    })
  },
  approver: {
    requestApproval: async ({ bindingDigest }) => ({
      approved: false,
      approverId: "release-owner",
      comment: "external publish waits for explicit release approval",
      bindingDigest
    })
  }
});

await runtime.run({
  name: "research-workflow",
  input: { topic: "agent provenance" },
  steps: [
    {
      id: "search",
      run: (context) =>
        context.callTool("research.search", { query: context.input.topic }, { purpose: "collect sources" })
    }
  ]
});
```

## Core API

- `AgentRuntime`: executes ordered workflow steps and owns policy/provenance/store coordination.
- `ToolRegistry`: registers named tools with descriptions, risk levels, optional input schemas, and execution handlers.
- `PolicyEngine`: decides `allow`, `deny`, or `require_approval` for each tool call.
- `Approver`: resolves required approvals with `approved`, `approverId`, optional comment and metadata, plus an exact echo of the request's `bindingDigest`.
- `InMemoryProvenanceSink`: captures runtime events for tests, logs, and adapters.
- `FileRunStore`: writes run snapshots as JSON files using atomic replacement.

## Event Model

Every emitted event includes:

- `runId`
- monotonically increasing `sequence`
- `type`
- ISO timestamp
- structured `data`
- `receipt.eventHash`
- `receipt.previousHash`
- `receipt.canonicalJson`

The hash chain lets downstream systems detect removed or reordered events inside one run trace. `ajnas-provenance` adds signed evidence bundles and export formats without changing the runtime contract; durable remote ledger storage remains a host concern.

## Safety Model

The runtime does not trust prompts or tool descriptions to enforce safety. Tool calls must pass the policy layer first. A policy can:

- allow low-risk calls
- deny dangerous calls before execution
- require approval for high-risk actions such as repository writes, package publishing, email sends, or production deploys

When no policy engine is configured, the runtime denies every tool call. Callers must opt into executable behavior by supplying an explicit policy.

If approval is required but no approver exists, the runtime throws `ApprovalRequiredError`. If the approver rejects the action, it throws `ApprovalRejectedError`. An approver response that does not exactly echo the request's `bindingDigest` is rejected with `ApprovalBindingError`, preventing a decision for one input or policy context from authorizing another. These paths are recorded in provenance before the workflow fails.

For staged, auditable human review, `ajnas-approvals` exports `createRuntimeApprover`. The adapter is structurally assignable to this package's `Approver` interface and does not introduce a package dependency in either direction. It maps approved and rejected terminal tickets to normal runtime responses and raises a typed `RuntimeApprovalPendingError` when a host has not resolved the ticket yet.

## Local Development

```bash
npm install
npm test
npm run typecheck
npm run build
npm run example:basic
npm run pack:dry
```

## Release Status

Version `0.2.0` is the current release candidate. Its metadata-only policy tool projection is an intentional security-motivated API break from `0.1.x`.
