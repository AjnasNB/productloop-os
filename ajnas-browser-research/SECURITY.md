# Security Notes

`ajnas-browser-research` is a governance harness, not a browser sandbox. It records policy, approvals, citations, and provenance around adapter-provided browsing. The adapter host remains responsible for browser isolation and network enforcement.

## Security Boundaries

- Use a container, virtual machine, hardened browser profile, or managed browser environment for untrusted pages.
- Enforce `robots.txt`, rate limits, credential boundaries, and tenant-specific network allowlists in the adapter.
- Do not use this package to bypass access controls, paywalls, CAPTCHA, anti-bot controls, private systems, or authorization boundaries.
- Treat browser output as untrusted input. Do not execute page content or copied scripts.
- Store full page text only when required. The default report stores output digests and summaries.
- Bind human approvals to exact run ids, step ids, input digests, and policy digests.
- Keep provenance signing keys outside browser sessions and CI logs.

## Supported Disclosure Path

Report security issues privately to the package owner before opening a public issue. Include the affected version, reproduction steps, and whether the issue requires a malicious adapter, malicious page content, or malformed plan input.
