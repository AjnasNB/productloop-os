# Browser Research Plan v1

Schema id: `ajnas.browser.research.plan.v1`

## Top-Level Fields

- `schema`: must be `ajnas.browser.research.plan.v1`.
- `id`: stable plan id.
- `objective`: human-readable research objective.
- `createdAt`: optional timestamp.
- `policy`: optional governance controls.
- `steps`: ordered browser research steps.
- `output`: optional output requirements.
- `metadata`: optional JSON metadata.

## Step Actions

- `search`: requires `query`; adapter returns ranked URLs and snippets.
- `open`: requires `url`; adapter returns page metadata, text, and optional citations.
- `extract`: requires `url`; adapter returns claims and citations.
- `crawl`: requires `url`; adapter returns crawled pages.
- `note`: records a structured note with optional citations.

## Policy Fields

- `allowedOrigins`: exact allowed URL origins such as `https://github.com`.
- `blockedOrigins`: exact denied URL origins.
- `allowedActions`: permitted action names.
- `maxSteps`: maximum executable steps.
- `requireApprovalForActions`: actions that must receive human approval before execution.
- `citationRequired`: fail a completed step if it produces no citation.
- `retainFullText`: include full opened-page text in report summaries. Defaults to false.

## Determinism

Plan digests use sorted JSON keys and SHA-256. Reports include plan digest, step input digests, adapter output digests, citation evidence digests, step digests, audit receipt hashes, and final report digest.
