# Publish Checklist

Selected release: `ajnas-browser-research@0.1.4`

This checklist prepares the coordinated patch; it is not a publication record until the protected workflow and post-publish checks succeed.

## Local Verification

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run example:basic
node bin/ajnas-browser-research.js validate fixtures/release-browser-plan.json
node bin/ajnas-browser-research.js digest fixtures/release-browser-plan.json
node bin/ajnas-browser-research.js run fixtures/release-browser-plan.json fixtures/replay-adapter-records.json > report.json
node bin/ajnas-browser-research.js verify-report report.json
node bin/ajnas-browser-research.js provenance report.json > provenance.json
npm run pack:dry
npm audit --omit=dev
npm view ajnas-browser-research version --json
```

Confirm the exact version is absent before publishing. If it already exists, stop; npm versions are immutable.

## Publish boundary

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

Create the annotated monorepo release tag from the exact verified source commit and retain the release-gate evidence.
