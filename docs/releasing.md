# Release process

Publishing is a human-authorized external side effect. Normal builds, tests, pull requests, Dependabot updates, and merges never publish npm packages.

The repository currently uses public `maqam@0.2.4` as its tested integration baseline. The nine previous workspace package versions already present on npm are immutable. This release source selects the following fresh coordinated versions:

| Package | Version |
| --- | ---: |
| `ajnas-runtime` | `0.2.1` |
| `ajnas-skills-registry` | `0.2.1` |
| `ajnas-provenance` | `0.1.3` |
| `ajnas-policy` | `0.1.2` |
| `ajnas-evals` | `0.1.2` |
| `ajnas-connectors` | `0.1.2` |
| `ajnas-approvals` | `0.1.2` |
| `ajnas-browser-research` | `0.1.3` |
| `productloop-os` | `0.2.1` |

## Trusted Publisher configuration

Configure a Trusted Publisher separately on npm for each package:

- `ajnas-runtime`
- `ajnas-skills-registry`
- `ajnas-provenance`
- `ajnas-policy`
- `ajnas-evals`
- `ajnas-connectors`
- `ajnas-approvals`
- `ajnas-browser-research`
- `productloop-os`

Every npm publisher entry must use these exact values:

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Organization or user | `AjnasNB` |
| Repository | `productloop-os` |
| Workflow filename | `publish-npm.yml` |
| Environment | `npm-publish` |

Create the GitHub `npm-publish` environment with required maintainer review and deployment restricted to protected `main`. Disable or avoid administrator bypass. The workflow stores no npm token and does not use a recovery code, automation token, `NODE_AUTH_TOKEN`, or repository secret. Revoke any reusable npm credential that has appeared in chat, logs, or shell history.

Only the protected publish job receives `id-token: write`. The unprivileged verify job installs dependencies, runs all tests and audits, builds the packages, creates nine tarballs, checks their exact hashes, and uploads them as a one-day workflow artifact. After environment approval, the OIDC job downloads those same tarballs; it does not install workspace dependencies or run package lifecycle scripts.

## Prepare an exact release

Start from a clean, reviewed `main` commit. Update package versions and changelogs deliberately, then update internal dependency ranges when a dependency version changes. A coordinated run requires a new version for all nine packages.

Run:

```sh
npm install --global npm@11.18.0 --ignore-scripts
npm --version # must print 11.18.0
npm ci
npm run verify
npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run release:manifest
```

The release workflow and local manifest preparation deliberately use npm `11.18.0`. Do not generate the approval manifest with another npm version: npm pack output and tarball bytes are CLI-version-sensitive. `release:manifest` packs the already-built outputs with lifecycle scripts disabled and prints the exact workflow JSON. Each entry contains only `version`, `sha256`, and npm `sha512` integrity. It writes temporary tarballs outside the repository unless `--output <directory>` is supplied.

Before dispatching, confirm that the commit and working tree are exact:

```sh
git status --short
git rev-parse HEAD
```

Open **Actions → Publish npm packages (trusted) → Run workflow** from `main` and supply:

1. `expected_commit`: the full lowercase 40-character output of `git rev-parse HEAD`.
2. `release_manifest`: the complete JSON printed by `npm run release:manifest`.
3. `confirmation`: `publish productloop-os packages from COMMIT`, replacing `COMMIT` with the same full hash.

The verification job must pass before GitHub offers the `npm-publish` environment approval. Review the commit and manifest summary, then use normal **Approve and deploy**. Do not use an administrator bypass.

## Enforced publication order

The protected job publishes and verifies one exact tarball at a time:

1. `ajnas-runtime`
2. `ajnas-skills-registry`
3. `ajnas-provenance`
4. `ajnas-policy`
5. `ajnas-evals`
6. `ajnas-connectors`
7. `ajnas-approvals`
8. `ajnas-browser-research`
9. `productloop-os`

For every package, the workflow verifies registry version, integrity, SLSA provenance, downloaded tarball SHA-256, and installed registry signatures. `productloop-os` is always last.

npm has no multi-package transaction. If a run stops after publishing some leaves, fix the external cause and rerun the same approved commit and manifest. A previously published version is skipped only when its registry integrity, provenance, downloaded SHA-256, and any reported `gitHead` match the approved identity exactly; any difference fails closed.

## Post-release

After all nine registry checks pass:

1. Install the exact public versions in a fresh consumer and run `productloop-os doctor` and the deterministic example.
2. Create signed or annotated Git tags only after npm success.
3. Publish GitHub release notes that list the exact package versions and workflow run.
4. Update website version tables and install commands, then run the website's live checks before deployment.

If registry verification fails, do not attempt to overwrite a version. npm versions are immutable; correct the source, increment the affected version, regenerate the complete manifest, and run a newly reviewed release.
