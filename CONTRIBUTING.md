# Contributing

ProductLoop OS is a TypeScript npm workspace. Contributions should keep package boundaries explicit, behavior deterministic, and high-risk effects opt-in.

## Development

Use Node.js 20.18.1 or newer and install from the root lockfile:

```sh
npm ci
npm run verify
```

The full gate builds and tests every workspace, typechecks public contracts, runs the umbrella integration and CLI doctor, and inspects all npm tarballs.

## Change requirements

- Add focused tests for behavior and security-boundary changes.
- Preserve deny-by-default behavior and exact approval binding.
- Keep canonical JSON input restrictions consistent across packages.
- Do not add local dependency paths, credentials, generated archives, or unrelated build output.
- Update the affected README, changelog, schemas, and comparison claims.
- Treat npm versions as immutable and publish only through the documented release gate.

Report security issues through the private process in [SECURITY.md](./SECURITY.md), not a public issue.
