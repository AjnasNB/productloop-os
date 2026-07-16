# Publish Checklist

Package: `ajnas-browser-research@0.1.2`

`ajnas-browser-research@0.1.2` was authorized and published to the public npm registry on 2026-07-15. This checklist records that release gate; every later version or different target requires fresh authorization.

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

## Publish Commands

Run only for the authorized version after all verification passes:

```bash
npm publish --access public
```

Create the annotated monorepo release tag from the exact verified source commit and retain the release-gate evidence.
