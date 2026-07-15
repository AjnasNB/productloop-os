# Ajnas Skill Manifest v1

The `ajnas.skill.v1` manifest is a compact contract for enterprise skill installation decisions.

## Required Fields

- `schemaVersion`: must be `ajnas.skill.v1`.
- `id`: reverse-domain skill id such as `com.ajnas.research-brief`.
- `name`: human-readable skill name.
- `version`: semantic version string.
- `description`: concise purpose statement.
- `license`: one of `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, or `ISC`.
- `entrypoint`: skill loading target with `type` set to `module`, `command`, or `mcp`.
- `compatibility.ajnasRuntime`: runtime range the skill expects.
- `capabilities`: named actions with descriptions and risk levels.
- `permissions`: network, filesystem, external publishing, secrets, and approval posture.
- `trust`: publisher, source, repository, and license evidence metadata.

## Risk Rules

The validator rejects manifests that set `permissions.humanApproval` to `never` while declaring any of these:

- a capability with `risk` of `high` or `critical`
- `permissions.filesystem` set to `write`
- `permissions.externalPublish` set to `true`

## Digest and Signature

`computeSkillDigest` canonicalizes object keys and returns `sha256:<hex>`. `signSkillManifest` signs a canonical envelope containing:

- purpose: `ajnas.skill_manifest.signature.v1`
- digest
- key id
- algorithm
- signing timestamp

The registry never trusts public keys embedded in a manifest. Callers provide a `keyResolver` backed by their own trust store.
