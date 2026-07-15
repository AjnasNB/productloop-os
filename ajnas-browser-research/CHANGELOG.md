# Changelog

## 0.1.1 - 2026-07-15

- Added the Node.js declaration dependency required by clean TypeScript consumers of the public `node:crypto` and `Buffer` types.

## 0.1.0 - 2026-07-15

- Added `ajnas.browser.research.plan.v1` validation and deterministic plan digests.
- Added governed browser research harness with `search`, `open`, `extract`, `crawl`, and `note` actions.
- Added replay adapter for deterministic release fixtures and tests.
- Added browser research policy decisions for origins, actions, step ceilings, required citations, and approval gates.
- Added approval request generation bound to run, plan, step, input, and policy digests.
- Added citation normalization across search results, page opens, extraction claims, crawled pages, and notes.
- Added hash-chained audit receipts and report verification.
- Added provenance bundle export and optional signature verification.
- Added CLI, fixtures, example, README, security notes, architecture notes, plan schema docs, provenance/license notes, and publish checklist.
- Added bounded canonical JSON validation and defensive cloning for plans, reports, policy records, provenance, and audit data.
