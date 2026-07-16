# Support

ProductLoop OS is maintained as an open-source project without a guaranteed response time or support-level agreement.

## Choose the right channel

- Questions, architecture discussions, integration ideas, examples, and adoption help: [ProductLoop OS Discussions](https://github.com/AjnasNB/productloop-os/discussions).
- Reproducible defects in this repository: use the GitHub bug-report template.
- Scoped feature requests: use the feature-request template after checking existing issues and discussions.
- Vulnerabilities, leaked credentials, private targets, or exploit details: follow [SECURITY.md](./SECURITY.md) and do not create a public issue or discussion.

Do not use an issue as a general support ticket. Please search existing documentation, discussions, and issues before opening a new thread.

## Information to provide

For technical help, include:

- affected package names and exact versions;
- Node.js, npm, operating-system, and runtime details;
- the smallest safe reproduction;
- expected and observed behavior;
- the exact verification command and sanitized output; and
- whether the operation uses a local fixture, mock, provider sandbox, or live provider.

Remove tokens, cookies, tenant identifiers, private URLs, user data, proprietary prompts, and sensitive evidence. Maintainers will not request an npm token, recovery code, private key, or production credential.

## Support boundary

ProductLoop OS supplies in-process governance and evidence primitives. It does not supply or operate a model provider, hosted control plane, production browser fleet, secret manager, identity provider, network sandbox, or distributed transaction system. Provider credentials, tenant configuration, external service availability, browser infrastructure, network policy, and operating-system isolation remain the deployer's responsibility.

The project can help diagnose its documented public contracts and deterministic fixtures. It cannot guarantee that an external provider, community connector, or production environment is correctly configured or safe.
