# Publish Checklist

Selected release: `ajnas-provenance@0.1.4`

This checklist prepares the coordinated patch; it is not a publication record until the protected workflow and post-publish checks succeed.

## Required Verification

Run from the `ajnas-provenance` package directory:

```bash
npm test
npm run typecheck
npm run build
npm run example:basic
node bin/ajnas-provenance.js verify fixtures/release-gate.bundle.json
node bin/ajnas-provenance.js digest fixtures/release-gate.bundle.json
npm run pack:dry
npm audit --omit=dev
npm view ajnas-provenance version --json
```

## Approval Gate

Confirm `0.1.4` is absent before publishing. If it already exists, stop because npm versions are immutable; an existing version may be skipped only by the protected workflow after exact identity verification.

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

Future versions, different registries, announcements, emails, and unrelated external actions require their own authorization.
