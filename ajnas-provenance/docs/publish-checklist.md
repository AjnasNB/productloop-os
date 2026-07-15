# Publish Checklist

Package: `ajnas-provenance@0.1.0`

`ajnas-provenance@0.1.0` was authorized for publication to the public npm registry on 2026-07-15. Every later version or different target requires fresh authorization.

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

The initial release approval is recorded. Confirm the exact version is absent before publishing; if it already exists, stop because npm versions are immutable.

Approved publish command:

```bash
npm publish --access public
```

Future versions, different registries, announcements, emails, and unrelated external actions require their own authorization.
