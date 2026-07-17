# Publish Checklist

Selected release: `ajnas-policy@0.1.2`. This checklist prepares the coordinated patch; it is not a publication record until the protected workflow and post-publish checks succeed.

## Preflight

```bash
npm test
npm run typecheck
npm run build
npm run example:basic
node bin/ajnas-policy.js validate fixtures/enterprise-release-policy.json
node bin/ajnas-policy.js digest fixtures/enterprise-release-policy.json
node bin/ajnas-policy.js evaluate fixtures/enterprise-release-policy.json fixtures/publish-request.json
npm run pack:dry
npm audit --omit=dev
npm view ajnas-policy version --json
```

Confirm the exact version is absent before publishing. If it already exists, stop; npm versions are immutable.

## Publish boundary

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

After publish:

```bash
npm view ajnas-policy version --json
```
