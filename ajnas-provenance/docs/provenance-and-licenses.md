# Provenance and License Notes

Generated: 2026-07-06

## OSS Research Inspected

- `@sigstore/bundle@5.0.0`: Apache-2.0, npm metadata inspected. Repository: `https://github.com/sigstore/sigstore-js.git`.
- `@sigstore/core@4.0.1`: Apache-2.0, npm metadata inspected. Repository: `https://github.com/sigstore/sigstore-js.git`.
- `@sigstore/sign@5.0.0`: Apache-2.0, npm metadata inspected. Repository: `https://github.com/sigstore/sigstore-js.git`.
- `@in-toto/attestation`: npm lookup returned E404 on 2026-07-06, so no package contents were inspected.

## Research Outcome

Sigstore package metadata reinforced the decision to model signatures as detached evidence over a deterministic digest and to keep algorithm metadata explicit. Ajnas does not implement transparency-log behavior in this release.

No repositories were cloned and no third-party packages were installed for product implementation. No third-party implementation code was copied, adapted, or pasted into `ajnas-provenance`.

## Ajnas Originality Notes

This package defines original Ajnas schema names, event shapes, policy APIs, import helpers, examples, tests, documentation, and release process. Runtime and skills-registry imports are structural adapters for local Ajnas packages, not copies of third-party APIs.
