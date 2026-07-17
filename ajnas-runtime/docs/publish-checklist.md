# Publish Checklist

Selected release: `ajnas-runtime@0.2.1`. This checklist prepares the coordinated patch; it is not a publication record until the protected workflow and post-publish checks succeed.

## Preflight

- [x] Package name selected: `ajnas-runtime`
- [x] Version selected: `0.2.1`
- [x] License selected: MIT
- [x] README present
- [x] CHANGELOG present
- [x] SECURITY notes present
- [x] Architecture notes present
- [x] Example workflow present
- [x] Tests present
- [x] Build script present
- [x] Package dry-run script present
- [ ] Exact source commit and nine-package manifest reviewed
- [ ] npm Trusted Publisher entry matches the repository workflow and environment
- [ ] Protected `npm-publish` environment approved by the maintainer

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

- [ ] Verify version, integrity, SLSA provenance, downloaded tarball SHA-256, and installed registry signatures.
- [ ] Create the annotated monorepo release tag from the exact verified source commit.
- [ ] Record the package URL, workflow run, integrity, and publish timestamp in the GitHub release.
