# Ajnas Trace Bundle v1

Schema version: `ajnas.provenance.bundle.v1`

## Event

Each event has:

- `schemaVersion`: `ajnas.provenance.event.v1`
- `traceId`: stable trace identifier.
- `sequence`: one-based event position.
- `timestamp`: ISO timestamp.
- `actor`: person, service, runtime, or automation responsible for the event.
- `action`: domain action such as `runtime.tool.completed` or `approval.requested`.
- `subject`: typed object being acted on.
- `source`: system and local id where the event came from.
- `data`: sanitized JSON object.
- `links`: related receipt or evidence links.
- `receipt`: hash, previous hash, and canonical JSON.

## Receipt

The event hash is SHA-256 over stable JSON containing the event and `receipt.previousHash`. The current `eventHash` and `canonicalJson` are excluded during hash calculation so replay can recompute them.

## Bundle

The bundle contains ordered events, `eventCount`, `rootHash`, `generatedAt`, `generatedBy`, `purpose`, and `digest`. The bundle digest is SHA-256 over stable JSON without the `digest` field.

## Signature

`signTraceBundle` signs a stable payload containing:

- purpose: `ajnas.provenance.bundle.signature.v1`
- algorithm
- digest
- keyId
- signedAt

The first supported algorithm is `ed25519`.
