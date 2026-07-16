## Summary

Describe the problem, the proposed behavior, and why this change belongs in ProductLoop OS.

Closes #

## Affected packages

- [ ] `ajnas-runtime`
- [ ] `ajnas-skills-registry`
- [ ] `ajnas-provenance`
- [ ] `ajnas-policy`
- [ ] `ajnas-evals`
- [ ] `ajnas-connectors`
- [ ] `ajnas-approvals`
- [ ] `ajnas-browser-research`
- [ ] `productloop-os`
- [ ] Documentation, tests, or community files only

## Public contract

List exported APIs, types, schemas, errors, CLI output, package contents, or adapter records that change. Write `None` when the public contract is unchanged.

## Security and effects

Describe any filesystem, process, browser, network, credential, notification, approval, or publication effects. Explain failure behavior, authorization, redaction, and any path that bypasses ProductLoop. Write `None` only after reviewing the boundary.

## Provider and benchmark claims

State exactly what was exercised: local fixture, mock, sandbox, provider account, or production-like environment. Link raw benchmark evidence and methodology when making a measured claim. Do not describe a fixture as a native integration or a project benchmark as certification.

## Verification

List the exact commands and relevant results.

```text
npm run verify
```

## Checklist

- [ ] The change is focused and uses a branch or fork, not a direct push to `main`.
- [ ] Focused tests cover success and relevant failure paths.
- [ ] `npm run verify` passes, or the blocker and unaffected checks are documented above.
- [ ] Security boundaries were reviewed when applicable.
- [ ] Public types and clean-consumer behavior were reviewed when applicable.
- [ ] Affected documentation and changelogs were updated.
- [ ] Provider and benchmark wording matches the evidence.
- [ ] No credentials, private data, local dependency paths, or generated archives are included.
- [ ] Package versions, tags, and npm publication are unchanged unless `@AjnasNB` explicitly requested a release change.

Only `@AjnasNB` can merge this pull request or perform a repository release. See [GOVERNANCE.md](https://github.com/AjnasNB/productloop-os/blob/main/GOVERNANCE.md).
