# Publish Checklist

`ajnas-runtime@0.2.0` is the current public security-boundary release. This checklist records its release gate; every later version or different target requires fresh authorization.

## Preflight

- [x] Package name selected: `ajnas-runtime`
- [x] Version selected: `0.2.0`
- [x] License selected: MIT
- [x] README present
- [x] CHANGELOG present
- [x] SECURITY notes present
- [x] Architecture notes present
- [x] Example workflow present
- [x] Tests present
- [x] Build script present
- [x] Package dry-run script present
- [x] User approves publishing this exact release
- [x] npm account/scope ownership verified
- [x] npm credential available only in the release environment

## Verification Commands

Run from the `ajnas-runtime` package directory:

```bash
npm test
npm run typecheck
npm run build
npm run example:basic
npm run pack:dry
```

## Publish boundary

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

## Post-Publish

- Create the annotated monorepo release tag from the exact verified source commit.
- Record package URL, tarball integrity, and publish timestamp in the automation memory.
