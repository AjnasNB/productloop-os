# Architecture

`ajnas-skills-registry` is intentionally small and policy-oriented.

## Modules

- `validation`: validates manifest structure, permissive license evidence, runtime compatibility, capability risk, permissions, and trust metadata.
- `signature`: computes deterministic digests and signs or verifies Ed25519 manifest envelopes.
- `registry`: stores manifests by `id@version`, verifies signatures when a key resolver is supplied, and rejects conflicting duplicate registrations.
- `audit`: records replayable hash-chained registry events.
- `policy`: exposes a runtime-compatible install policy for `skills.install` tools.
- `approval-queue`: serializes human review requests and their resolutions.
- `cli`: provides local validation and digest commands for release workflows.

## Data Flow

1. A producer writes a manifest with capability, permission, compatibility, trust, and license metadata.
2. CI runs `ajnas-skills validate` and records the manifest digest.
3. A release owner signs the manifest digest with an Ed25519 key.
4. A deployment registry resolves the key id from an internal trust store and registers the signed manifest.
5. The registry emits an audit event with a chained receipt.
6. Runtime install tools call `createSkillInstallPolicy` before accepting a skill.
7. Untrusted publishers or high-risk permissions move through a human approval queue.

## Boundary With `ajnas-runtime`

The package does not import runtime internals. Its policy helper follows the same structural contract as the runtime `PolicyEngine`: an `evaluate` method receives a tool call request and returns `allow`, `deny`, or `require_approval`. The optional peer keeps the registry independently usable while preserving direct runtime compatibility.
