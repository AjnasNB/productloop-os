# Architecture

`ajnas-connectors` is built around a manifest-first control plane.

## Components

- `ConnectorManifest`: declarative connector identity, runtime, auth, permission, capability, trust, and policy hint metadata.
- `validateConnectorManifest`: deterministic structural and safety validation for manifests.
- `computeConnectorDigest`: SHA-256 digest over stable canonical JSON.
- `evaluateConnectorTrust`: trust decision function that returns `allow`, `require_approval`, or `deny`.
- `createConnectorPolicyRequest`: maps connector invocation metadata into an Ajnas runtime policy request.
- `ConnectorRegistry`: in-memory registry with deterministic listing, filtering, policy context creation, and optional audit receipts.
- `ConnectorAuditLedger`: replayable hash-chained audit events for registry, trust, invocation, and approval activity.
- `ConnectorApprovalQueue`: durable-shaped approval request records that can be serialized by host systems.

## Design Principles

The package keeps connector adapters separate from connector governance. A browser, crawler, REST client, MCP client, GitHub client, or npm publisher can use the same manifest and policy surface without importing a specific transport implementation.

Trust evaluation is deterministic and side-effect free. It does not fetch package metadata, inspect repositories, call external APIs, or read secrets. Host systems can attach current review evidence to the manifest and keep the trust decision replayable.

## Integration Pattern

1. Validate a connector manifest.
2. Register the manifest in `ConnectorRegistry`.
3. Create a connector invocation request for a planned external action.
4. Convert the invocation to runtime policy context with `createConnectorPolicyRequest`.
5. Evaluate connector trust.
6. If the decision is `require_approval`, create a `ConnectorApprovalQueue` request and stop.
7. Record audit events for the registry, trust decision, invocation request, and approval outcome.
