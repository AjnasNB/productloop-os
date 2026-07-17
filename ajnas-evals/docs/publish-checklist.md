# Publish Checklist

Selected release: `ajnas-evals@0.1.2`. This checklist prepares the coordinated patch; it is not a publication record until the protected workflow and post-publish checks succeed.

Before publishing:

1. Run `npm test`.
2. Run `npm run typecheck`.
3. Run `npm run build`.
4. Run `npm run example:basic`.
5. Run `node bin/ajnas-evals.js validate fixtures/release-eval-suite.json`.
6. Run `node bin/ajnas-evals.js digest fixtures/release-eval-suite.json`.
7. Run `node bin/ajnas-evals.js run fixtures/release-eval-suite.json fixtures/release-run-artifacts.json`.
8. Save the report and run `node bin/ajnas-evals.js verify-report <report.json>`.
9. Run `npm run pack:dry`.
10. Run `npm audit --omit=dev`.
11. Confirm the npm package name and target account.

Future coordinated versions are published only by the protected Trusted Publishing workflow. Do not run `npm publish` locally or provide a reusable npm token. Follow the exact manifest, environment approval, and leaf-first order in [the monorepo release process](../../docs/releasing.md).

Use the annotated monorepo release tag rather than separate package tags for the coordinated initial release.
