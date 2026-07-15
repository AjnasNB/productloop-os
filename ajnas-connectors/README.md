# ajnas-connectors

`ajnas-connectors` is a connector trust and governance SDK for enterprise agent infrastructure. It defines original Ajnas connector manifests for MCP, REST, browser, search, crawl, GitHub, npm, package publishing, and custom connectors, then turns those manifests into deterministic validation, runtime policy context, human approval requests, and replayable audit receipts.

The package is designed to sit beside `ajnas-runtime`, `ajnas-policy`, and `ajnas-provenance` without requiring those packages at runtime.

## Install

```bash
npm install ajnas-connectors
```

## Quick Start

```js
import {
  ConnectorApprovalQueue,
  ConnectorAuditLedger,
  ConnectorRegistry,
  evaluateConnectorTrust,
  validateConnectorManifest
} from "ajnas-connectors";

const validation = validateConnectorManifest(manifest);
if (!validation.valid) {
  throw new Error(JSON.stringify(validation.issues));
}

const audit = new ConnectorAuditLedger();
const registry = new ConnectorRegistry({ audit });
registry.register(manifest, { actorId: "platform-engineer" });

const trust = evaluateConnectorTrust(manifest, { request: invocation });
if (trust.decision === "require_approval") {
  const approvals = new ConnectorApprovalQueue();
  approvals.request({
    manifest,
    invocation,
    trustEvaluation: trust,
    reason: trust.reasons.join(" "),
    requestedBy: "platform-engineer"
  });
}
```

## CLI

```bash
ajnas-connectors validate fixtures/enterprise-release-publisher.connector.json
ajnas-connectors digest fixtures/enterprise-release-publisher.connector.json
ajnas-connectors trust fixtures/enterprise-release-publisher.connector.json
ajnas-connectors policy-context fixtures/enterprise-release-publisher.connector.json fixtures/publish-invocation.json
ajnas-connectors registry-summary fixtures/enterprise-release-publisher.connector.json
```

## Manifest Model

Connector manifests use `ajnas.connector.manifest.v1`. A manifest declares connector identity, kind, publisher, runtime transport, auth mode, permissions, capabilities, trust metadata, sandbox expectations, and policy hints.

The validator enforces:

- MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, or ISC license metadata.
- Explicit permissions, resources, operations, destinations, and data classes.
- High or critical risk for publish, delete, credential, and secret access.
- Human approval requirements for publish and delete capabilities.
- Review and sandbox metadata that policy engines can inspect.

## Enterprise Safety Model

`evaluateConnectorTrust` returns `allow`, `require_approval`, or `deny`. Deny wins for invalid manifests, blocked reviews, disallowed licenses, blocked operations, and blocked data classes. Approval gates are raised for high-risk operations, write/publish/delete operations, unreviewed connectors, required source review, secret-bearing data classes, and manifest policy hints.

`createConnectorPolicyRequest` converts a connector invocation into an Ajnas runtime-compatible policy request with connector identity, capability, operation, trust decision, manifest digest, request digest, destinations, data classes, auth mode, and publisher metadata.

`ConnectorAuditLedger` records hash-chained receipts for registry, trust, invocation, and approval events. `ConnectorApprovalQueue` provides resumable human review records for actions that must not run automatically.

The package does not call external services. Connector manifests and invocation adapters decide how external systems are reached.
