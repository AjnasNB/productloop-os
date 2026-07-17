# Publish Checklist

Package: `ajnas-provenance@0.1.2`

`ajnas-provenance@0.1.2` was authorized and published to the public npm registry on 2026-07-15. This checklist records that release gate; every later version or different target requires fresh authorization.

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

The `0.1.2` patch release approval is recorded. Confirm the exact version is absent before publishing; if it already exists, stop because npm versions are immutable.

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

Future versions, different registries, announcements, emails, and unrelated external actions require their own authorization.
