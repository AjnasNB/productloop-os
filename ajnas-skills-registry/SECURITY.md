# Security Policy

`ajnas-skills-registry` is a local governance component for skill metadata. It does not execute skill code, fetch remote packages, or publish artifacts by itself.

Its install-policy helper denies unrelated tools. Approval queue resolutions require a real boolean and non-empty approver identity, and an approved or rejected request cannot be resolved again.

Canonical JSON normalization accepts only own enumerable data descriptors. Accessors and inherited descriptor fields are rejected without invoking getters, including when `Object.prototype` is polluted.

## Supported Version

- `0.2.x`: current metadata-only policy contract and strict signed-manifest release line.

## Security Model

- Skill manifests must use the `ajnas.skill.v1` schema.
- License identifiers are restricted to MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, and ISC.
- High-risk capabilities, filesystem write access, and external publishing require a human approval mode other than `never`.
- Signed manifests use Ed25519 keys only and cover a canonical payload containing digest, key id, algorithm, and signing timestamp. Envelopes have exact runtime-validated shapes, and registries consume defensive manifest snapshots.
- Registry audit events are hash chained so removed or reordered events can be detected during replay.

## Operational Guidance

- Resolve signing keys from an internal trust store, not from the manifest itself.
- Treat `trust.repository` and `licenseEvidence` as review inputs, not as proof of safety.
- Pair `createSkillInstallPolicy` with `ajnas-runtime` approval handling before allowing installs from community or vendor publishers.
- Do not install or execute a skill solely because signature verification passed; signatures identify reviewed bytes but do not prove behavior is safe.

## Reporting

Report suspected vulnerabilities privately to the project owner. Do not include secrets, private keys, or unpublished customer manifests in reports.
