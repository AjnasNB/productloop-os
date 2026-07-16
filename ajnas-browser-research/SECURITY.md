# Security Notes

`ajnas-browser-research` is a governance harness, not a browser sandbox. It records policy, approvals, citations, and provenance around adapter-provided browsing. The adapter host remains responsible for browser isolation and network enforcement.

## Security Boundaries

- Use a container, virtual machine, hardened browser profile, or managed browser environment for untrusted pages.
- Enforce `robots.txt`, rate limits, credential boundaries, and tenant-specific network allowlists in the adapter.
- Do not use this package to bypass access controls, paywalls, CAPTCHA, anti-bot controls, private systems, or authorization boundaries.
- Treat browser output as untrusted input. Do not execute page content or copied scripts.
- Canonical JSON normalization accepts only own enumerable data descriptors; accessors and inherited descriptor fields are rejected without invoking getters, including when `Object.prototype` is polluted.
- Store full page text only when required. The default report stores output digests and summaries.
- Bind human approvals to exact run ids, step ids, input digests, and policy digests.
- Require each resolution to echo the exact derived approval request id; malformed or foreign resolutions fail closed and stop the plan.
- The harness snapshots and freezes the complete canonical plan before validation or hashing. Approval providers and adapters receive detached clones, so later caller/provider/adapter mutation cannot change authorized or logged input.
- Keep provenance signing keys outside browser sessions and CI logs.
- Provenance signatures cover a canonical envelope containing a fixed purpose, bundle digest, algorithm, and key id. Ed25519, RSA PKCS#1 v1.5, RSA-PSS, and EC keys are accepted only under their corresponding algorithm labels.
- A signed provenance bundle is invalid unless verification receives a public key and validates the exact signature shape, key type, and canonical base64 encoding; supplying a public key also requires a signature to prevent unsigned downgrade.

## Supported Disclosure Path

Report security issues privately to the package owner before opening a public issue. Include the affected version, reproduction steps, and whether the issue requires a malicious adapter, malicious page content, or malformed plan input.
