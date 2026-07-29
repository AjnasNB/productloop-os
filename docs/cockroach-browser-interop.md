# Cockroach Browser capability snapshot

ProductLoop OS can inspect the structural capability snapshot published by
Cockroach Browser without importing or controlling its runtime.

This integration has one purpose: let a host discover which named browser
capabilities a separately installed Cockroach Browser release declares. It is
not a connector registration, permission grant, approval, authority token,
runtime health check, or proof that a configured browser session can exercise
every declared capability.

## Install the packages separately

```sh
npm install productloop-os
npm install cockroach-browser
```

`productloop-os` remains MIT licensed and does not require the AGPL-licensed
Cockroach Browser runtime as a dependency. The host chooses whether to install
and operate Cockroach Browser under its own license and deployment policy.

## Read the published snapshot

```js
import { productLoopBrowserCapabilitySnapshot } from "cockroach-browser/productloop";
import { adaptCockroachBrowserCapabilitySnapshot } from "productloop-os";

const snapshot = adaptCockroachBrowserCapabilitySnapshot(
  productLoopBrowserCapabilitySnapshot()
);

console.log(snapshot.schemaVersion);
console.log(snapshot.transports);
console.log(snapshot.capabilities);
```

The accepted schema is
`cockroach.productloop-capability-snapshot.v1`. The adapter validates the exact
identity, kind, structural-only scope, transport tuple, and authority labels.
It rejects missing or unknown fields, rejects duplicate capability IDs, copies
the data, and returns a deeply frozen view.

## Authority boundary

The three authority fields are assertions about ownership boundaries, not
handles to those boundaries:

| Field | Required value | Meaning |
| --- | --- | --- |
| `lifecycle` | `host` | The browser host owns daemon, session, tab, profile, and shutdown lifecycle. |
| `governance` | `maqam-when-routed` | Maqam governs only actions that the host explicitly routes through its registered adapter and ToolGateway. |
| `rawRuntime` | `host-policy` | ProductLoop does not authorize direct runtime calls; the host must enforce origins, effects, credentials, budgets, and infrastructure controls. |

The returned object deliberately has no `register`, `execute`, `runtime`,
credential, profile, session, or network field. Rejecting unknown fields
prevents a future or tampered payload from being silently interpreted as new
authority under the version 1 contract.

## What ProductLoop may do with the data

A host may use the frozen snapshot to:

- render a capability inventory;
- compare declared capability IDs with workflow requirements;
- record which schema version was reviewed;
- decide whether a separately reviewed adapter is needed; or
- fail closed when the snapshot contract changes.

It must not infer that a declared capability is installed, healthy,
authenticated, allowed for the current user, or approved for the current
action. Those facts require live checks at their owning boundary.

## Consequential browser actions

When browser actions need Maqam governance, wire Cockroach Browser through
Maqam's reviewed browser-driver adapter. ProductLoop can compose the surrounding
workflow and evidence records, but this capability snapshot never registers
that driver and never bypasses Maqam's exact approval path.

Direct Cockroach Browser SDK, HTTP, CLI, or MCP action calls remain outside
Maqam unless the host routes them through that path. Direct calls also remain
outside ProductLoop policy unless the host explicitly registers and invokes a
separate reviewed ProductLoop tool.

## Contract upgrades

ProductLoop rejects a schema version other than version 1. A new Cockroach
Browser snapshot version requires an explicit ProductLoop review, tests, and
adapter update. This makes authority drift visible instead of accepting it as a
routine metadata change.
