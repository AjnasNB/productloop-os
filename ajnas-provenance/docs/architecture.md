# Architecture

`ajnas-provenance` has four small boundaries:

- `TraceLedger` records normalized trace events and computes receipt hashes.
- Import helpers translate compatible Ajnas runtime and skills-registry receipts into one trace without depending on those packages at runtime.
- Bundle helpers package events into deterministic release evidence and verify replay.
- Policy and CLI helpers make the trace usable in approval workflows and release automation.

## Event Flow

1. A caller records or imports an event.
2. The ledger sanitizes and redacts JSON data.
3. The ledger builds canonical JSON with the previous hash.
4. The event hash is computed and stored in the receipt.
5. `createTraceBundle` exports events with event count, root hash, and bundle digest.
6. Optional signing binds the bundle digest to an Ed25519 key.

## Package Boundaries

The package intentionally accepts structural runtime and registry event shapes instead of importing `ajnas-runtime` or `ajnas-skills-registry`. This keeps provenance available as independent infrastructure and avoids cyclic release coupling.

## Failure Modes

`verifyTrace` and `verifyTraceBundle` return structured issues instead of throwing for invalid evidence. This makes them suitable for policy gates, CI, and human approval queues.
