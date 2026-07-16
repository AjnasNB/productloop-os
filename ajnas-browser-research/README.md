# Ajnas Browser Research

`ajnas-browser-research` is an MIT-licensed browser research harness for enterprise agent infrastructure. It wraps browser, search, crawl, and note adapters with deterministic policy decisions, replayable step logs, citation capture, human approval gates, and hash-chained provenance receipts.

The package is not a browser engine and does not depend on Playwright, Crawlee, hosted browsers, or a model provider. Those tools can be registered behind the adapter interface; Ajnas records the governed run around them.

## What Ships

- `BrowserResearchHarness` for running declarative browser research plans.
- `ReplayBrowserAdapter` for deterministic tests, fixtures, and audit replay.
- `validateBrowserResearchPlan` and deterministic plan digests for `ajnas.browser.research.plan.v1`.
- Per-step policy decisions for allowed origins, allowed actions, blocked origins, step ceilings, required citations, and approval-required actions.
- Human approval request objects that bind the run id, plan id, step id, input digest, and policy digest.
- Citation normalization for search results, opened pages, extraction claims, crawled pages, and notes.
- `BrowserResearchAuditLedger` with hash-chained receipts.
- Report and provenance bundle verification helpers.
- Optional signed provenance bundles.
- `ajnas-browser-research` CLI with `validate`, `digest`, `run`, `verify-report`, and `provenance`.

## Install

```bash
npm install ajnas-browser-research
```

## Basic Use

```js
import {
  ReplayBrowserAdapter,
  runBrowserResearchPlan,
  verifyBrowserResearchReport
} from "ajnas-browser-research";

const report = await runBrowserResearchPlan(plan, {
  adapter: new ReplayBrowserAdapter(replayRecords),
  runId: "run_release_fixture"
});

console.log(report.status);
console.log(verifyBrowserResearchReport(report).valid);
```

## CLI

```bash
ajnas-browser-research validate fixtures/release-browser-plan.json
ajnas-browser-research digest fixtures/release-browser-plan.json
ajnas-browser-research run fixtures/release-browser-plan.json fixtures/replay-adapter-records.json > report.json
ajnas-browser-research verify-report report.json
ajnas-browser-research provenance report.json > provenance.json
```

## Plan Shape

Plans use `ajnas.browser.research.plan.v1`:

```json
{
  "schema": "ajnas.browser.research.plan.v1",
  "id": "release-research",
  "objective": "Collect public release evidence",
  "policy": {
    "allowedOrigins": ["https://github.com", "https://www.npmjs.com"],
    "allowedActions": ["search", "open", "extract", "note"],
    "maxSteps": 8,
    "citationRequired": true,
    "requireApprovalForActions": ["crawl"]
  },
  "steps": [
    {
      "id": "search-browser-controls",
      "action": "search",
      "purpose": "Find public metadata",
      "query": "browser automation trace provenance"
    }
  ]
}
```

## Adapter Boundary

Adapters can use a local browser, a hosted browser session, an internal search service, or a crawler. The harness only requires action methods such as `search`, `open`, `extract`, `crawl`, and `note`.

This keeps the Ajnas contract original:

- Browser engines stay optional and replaceable.
- Policy decisions are made before adapter execution.
- High-risk steps fail closed until approval is resolved.
- Outputs are summarized by default; full page text is retained only when `retainFullText` is true.
- Citations and output digests survive without storing raw browser state.

## Security Model

The harness does not bypass access controls, paywalls, CAPTCHA, anti-bot systems, or `robots.txt`. Production adapters should enforce network allowlists, credential handling, tenant isolation, page timeouts, and browser sandboxing outside this package. See [SECURITY.md](SECURITY.md).

## Publish

Version `0.1.2` is the current release candidate. It adds fail-closed approval validation, immutable plan snapshots, canonical metadata-bound signatures, and strict signing-key correspondence.
