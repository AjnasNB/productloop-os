# Architecture

`ajnas-browser-research` separates browser execution from research governance.

## Components

- Plan validation: validates `ajnas.browser.research.plan.v1` and computes deterministic digests.
- Policy evaluator: checks action, origin, blocked origin, step count, citation, and approval rules before execution.
- Adapter interface: accepts browser/search/crawl implementations without making any browser engine a package dependency.
- Harness: runs approved steps, records output digests, summarizes output, extracts citations, and fails closed on missing approval or missing required citations.
- Audit ledger: writes hash-chained receipts for run start, policy decision, approval request, approval resolution, step completion, and run completion.
- Provenance bundle: exports citations and receipts with deterministic bundle digests and optional signatures.
- CLI: exposes validation, digesting, replayed runs, report verification, and provenance export.

## Design Decisions

The package intentionally does not expose a Playwright-shaped or Crawlee-shaped API. Public browser automation projects informed the need for adapter boundaries, trace replay, and crawl compliance, but Ajnas keeps a different contract centered on policy, human review, evidence digests, and provenance receipts.

Adapters may be implemented using local browsers, hosted browser sessions, internal crawlers, or search services. Those adapters should enforce the hard execution boundary: browser sandboxing, network controls, credentials, cookies, and rate limits.

## Failure Modes

- Invalid plans throw before execution.
- Denied policy decisions stop the run with `denied`.
- Approval-required decisions stop the run with `awaiting_approval` unless an approval provider returns an approved resolution.
- Adapter exceptions stop the run with `failed`.
- Citation-required steps fail if no citation can be normalized.
- Report and provenance verification fail if any digest or receipt chain is modified.
