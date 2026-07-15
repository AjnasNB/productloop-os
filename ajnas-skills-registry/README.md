# ajnas-skills-registry

Signed enterprise skill manifest registry with policy and provenance hooks for Ajnas runtimes.

`ajnas-skills-registry` is the package that lets an Ajnas deployment decide which skills can be installed, reviewed, trusted, and replayed. It is designed for enterprise agent infrastructure where skills need explicit capability metadata, permissive license evidence, deterministic digests, signature verification, policy gates, and audit receipts.

The package is original Ajnas implementation work. It was shaped by prior public OSS research, but it does not vendor or copy third-party source code, examples, docs, or branding.

## Install

```bash
npm install ajnas-skills-registry
```

`ajnas-runtime` is an optional peer dependency. The registry policy helper is structurally compatible with the runtime `PolicyEngine` contract and can be used without importing runtime types.

## Quick Start

```ts
import { generateKeyPairSync } from "node:crypto";
import {
  SkillAuditLedger,
  SkillRegistry,
  createSkillInstallPolicy,
  signSkillManifest
} from "ajnas-skills-registry";

const manifest = {
  schemaVersion: "ajnas.skill.v1",
  id: "com.ajnas.research-brief",
  name: "Research Brief",
  version: "1.0.0",
  description: "Turns approved research notes into a concise internal brief.",
  license: "MIT",
  entrypoint: { type: "module", value: "./dist/research-brief.js" },
  compatibility: { ajnasRuntime: "^0.1.0" },
  capabilities: [
    {
      name: "research.summarize",
      description: "Summarize reviewed research notes.",
      risk: "medium"
    }
  ],
  permissions: {
    network: "none",
    filesystem: "read",
    externalPublish: false,
    humanApproval: "on_high_risk"
  },
  trust: {
    source: "first-party",
    publisher: "ajnas",
    repository: "https://github.com/ajnas/examples",
    licenseEvidence: {
      kind: "repository",
      checkedAt: "2026-07-05T02:00:00.000Z"
    }
  }
};

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const signed = signSkillManifest(manifest, {
  algorithm: "ed25519",
  keyId: "ajnas-release-key",
  privateKey
});

const audit = new SkillAuditLedger();
const registry = new SkillRegistry({
  audit,
  keyResolver: (keyId) => (keyId === "ajnas-release-key" ? publicKey : null)
});

registry.register(signed, {
  actor: "release-automation",
  source: "internal-review"
});

const installPolicy = createSkillInstallPolicy({
  trustedPublishers: ["ajnas"]
});
```

## CLI

```bash
ajnas-skills validate fixtures/research-brief.skill.json
ajnas-skills digest fixtures/research-brief.skill.json
```

`validate` prints validation status, issue codes, and the deterministic digest for valid manifests. `digest` prints only the canonical `sha256:<hex>` digest and exits non-zero if the manifest fails validation.

## Core API

- `validateSkillManifest(manifest)`: validates schema version, package identity, permissive license, runtime compatibility, capability risk metadata, permissions, and trust evidence.
- `computeSkillDigest(manifest)`: produces a deterministic `sha256:<hex>` digest from canonical JSON.
- `signSkillManifest(manifest, options)`: signs the digest envelope with Ed25519 key material.
- `verifySkillSignature(envelope, publicKey)`: verifies digest integrity and Ed25519 signature material.
- `SkillRegistry`: registers signed or unsigned manifests, rejects conflicting duplicates, and records audit events.
- `SkillAuditLedger`: emits replayable hash-chained audit receipts for registry activity.
- `createSkillInstallPolicy(options)`: returns a runtime-compatible policy engine for `skills.install` tool calls.
- `SkillApprovalQueue`: serializes review requests and approval resolutions for resumable human review workflows.

## Safety Model

The registry treats skill installation as a governed supply-chain action. A skill must declare what it can do, what it needs, who published it, which permissive license evidence was checked, and whether human approval is required for high-risk behavior.

Validation rejects non-permissive license identifiers and high-risk manifests that disable approval. Runtime policy can deny invalid manifests, require approval for untrusted publishers, and require approval for high-risk permissions.

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

Version `0.1.0` is the initial public release, authorized for the public npm registry on 2026-07-15. A different version or registry target requires fresh authorization.
