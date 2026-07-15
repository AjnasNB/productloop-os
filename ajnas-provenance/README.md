# ajnas-provenance

`ajnas-provenance` is an Ajnas package for append-only agent evidence traces. It records runtime events, skills-registry audit events, connector activity, policy decisions, approval checkpoints, and release evidence as replayable hash-chained receipts.

The package is designed for enterprise agent infrastructure where teams need deterministic audit exports before high-risk actions such as external publishing, connector installation, or regulated data movement.

## Features

- `TraceLedger` for append-only provenance events with SHA-256 receipt chains.
- Deterministic canonical JSON for replay verification.
- Default redaction for sensitive fields such as tokens, secrets, passwords, API keys, and authorization headers before receipts are calculated.
- Import helpers for `ajnas-runtime` events and `ajnas-skills-registry` audit receipts.
- Signed trace bundles with Ed25519 signatures.
- Runtime-compatible export policy for approval and deny gates.
- CLI verification with `ajnas-provenance verify`.

## Install

```bash
npm install ajnas-provenance
```

This package has no runtime dependencies. `ajnas-runtime` and `ajnas-skills-registry` are optional peer packages because imports accept compatible receipt shapes.

## Basic Usage

```ts
import {
  TraceLedger,
  createTraceBundle,
  createProvenanceExportPolicy,
  verifyTraceBundle
} from "ajnas-provenance";

const ledger = new TraceLedger({ traceId: "trace_release_001" });

ledger.record({
  actor: "release-bot",
  action: "approval.requested",
  subject: { type: "package", id: "ajnas-provenance@0.1.0" },
  source: { system: "ajnas-provenance", id: "release-gate" },
  data: {
    destination: "npm",
    dataClasses: ["public"],
    token: "will be redacted before hashing"
  }
});

const bundle = createTraceBundle(ledger.events, {
  generatedBy: "release-bot",
  purpose: "release-gate"
});

console.log(verifyTraceBundle(bundle));
```

## Runtime and Registry Imports

Use `importRuntimeEvent` and `importSkillAuditEvent` to preserve upstream receipt links without copying the upstream implementation. Imported events get source links such as `ajnas-runtime:run_001:7` and `ajnas-skills-registry:skill@version:3`.

```ts
import { TraceLedger, importRuntimeEvent } from "ajnas-provenance";

const ledger = new TraceLedger({ traceId: "trace_from_runtime" });

importRuntimeEvent(ledger, runtimeEvent);
```

## Export Policy

`createProvenanceExportPolicy` returns an object compatible with the Ajnas runtime policy contract. It can deny blocked destinations and require human approval when sensitive data classes are exported.

```ts
const policy = createProvenanceExportPolicy({
  blockedDestinations: ["public-web"],
  approvalDestinations: ["npm", "github-release"],
  sensitiveDataClasses: ["secret", "personal-data"]
});
```

The returned policy plugs directly into `AgentRuntime`, including with strict function-parameter checking:

```ts
import { AgentRuntime } from "ajnas-runtime";
import { createProvenanceExportPolicy } from "ajnas-provenance";

const runtime = new AgentRuntime({
  policy: createProvenanceExportPolicy({
    blockedDestinations: ["public-web"]
  })
});
```

The export policy receives only the tool identity and risk fields it evaluates. It neither imports the runtime nor receives the runtime tool's execution callback.

## CLI

Build first, then verify a bundle:

```bash
npm run build
ajnas-provenance verify fixtures/release-gate.bundle.json
ajnas-provenance digest fixtures/release-gate.bundle.json
```

The `verify` command prints `valid <digest>` for replayable traces and returns exit code `1` for tampered bundles.

## Security Model

Receipts make tampering detectable, not impossible. Keep exported bundles immutable in your storage layer, protect signing keys outside application logs, and run exports through an approval policy when bundles include sensitive data classes or are destined for external systems.

See [SECURITY.md](SECURITY.md) and [docs/trace-bundle-v1.md](docs/trace-bundle-v1.md).
