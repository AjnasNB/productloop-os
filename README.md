# ProductLoop OS

ProductLoop OS is the ecosystem and runtime companion to [Maqam](https://maqamagent.com). Maqam is the governed execution kernel: it binds policy, exact approvals, tool execution, and source-linked evidence at the side-effect boundary. ProductLoop surrounds that kernel with small, independently publishable packages for workflow runtime, policy decisions, approval operations, connector trust, skill manifests, provenance, deterministic evaluations, and browser-research records.

Use the [Maqam website](https://maqamagent.com) for the product overview and the [ProductLoop package atlas](https://maqamagent.com/docs/productloop/) for package-by-package documentation. The detailed [Maqam and ProductLoop relationship](./docs/maqam-and-productloop.md) explains which package to install and which integration boundaries remain explicit.

The projects form one ecosystem, not one silently merged runtime. `createProductLoopOS()` exposes the Maqam namespace and creates both Maqam and Ajnas package components, while their contracts and ledgers remain distinct. The bundled Maqam crawler bridge is opt-in and is never registered automatically. Direct calls to a provider, browser, connector, model SDK, or Maqam tool outside a governed runtime path are not intercepted by ProductLoop.

The ecosystem is a governance toolkit, not a claim of autonomous intelligence. It does not ship a model, a hosted control plane, a secret manager, a production browser, or a distributed job system. `ajnas-browser-research` supplies a governed adapter contract and deterministic replay harness. Real browser, search, connector, model, and storage implementations remain explicit deployment choices.

## Packages

The table below records the coordinated patch versions and dependency ranges selected in source. They are not public releases until the protected workflow verifies and publishes the exact registry artifacts.

| Package | Release version or range | Responsibility |
| --- | ---: | --- |
| [`productloop-os`](./productloop-os) | `0.2.2` | One install, named namespaces, tested adapters, and composition helpers |
| [`maqam`](https://github.com/AjnasNB/maqam) | `^0.2.4 || ^0.3.1` dependency | Governed execution kernel, exact approvals, evidence, provider-neutral tool adapters, CLI-agent tools, and crawler-backed research |
| [`ajnas-runtime`](./ajnas-runtime) | `0.2.2` | Ordered workflows and policy-gated tool calls |
| [`ajnas-policy`](./ajnas-policy) | `0.1.3` | Declarative allow, deny, and approval decisions |
| [`ajnas-approvals`](./ajnas-approvals) | `0.1.3` | Human review tickets, delegation, escalation, and audit history |
| [`ajnas-provenance`](./ajnas-provenance) | `0.1.4` | Hash-linked traces, bundles, signatures, and redaction |
| [`ajnas-skills-registry`](./ajnas-skills-registry) | `0.2.2` | Signed skill manifests and install policy |
| [`ajnas-connectors`](./ajnas-connectors) | `0.1.3` | Connector manifests, permissions, and trust evaluation |
| [`ajnas-evals`](./ajnas-evals) | `0.1.3` | Deterministic assertions and verifiable evaluation reports |
| [`ajnas-browser-research`](./ajnas-browser-research) | `0.1.4` | Policy-aware research plans, replay adapters, citations, and evidence exports |

## Install

```sh
npm install productloop-os
```

```js
import { createProductLoopOS, runtime } from "productloop-os";

const os = createProductLoopOS();

os.tools.register({
  name: "local.echo",
  description: "Return local structured data",
  risk: "low",
  execute: ({ input }) => input
});

const run = await os.runtime.run({
  name: "example",
  input: { message: "hello" },
  steps: [
    {
      id: "echo",
      run: (context) => context.callTool("local.echo", context.input)
    }
  ]
});

os.importRuntimeEvents();
console.log(run.status, os.trace.events.length, runtime.AgentRuntime.name);
```

Every dependency is also available as a named namespace: `maqam`, `runtime`, `skills`, `provenance`, `policy`, `evals`, `connectors`, `approvals`, and `browserResearch`.

## CLI

```sh
npx productloop-os doctor
npx productloop-os info
```

`doctor` verifies the Node version and that every packaged module can be loaded. It does not claim that external credentials, browsers, model providers, or production services are configured.

## Development

ProductLoop OS supports the maintained Node.js 22 LTS, 24 LTS, and 26 Current release lines.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run integration
npm run pack
```

Maqam `^0.2.4 || ^0.3.1` is the supported compatibility range. The canonical workspace lockfile and default clean-consumer test resolve the public `maqam@0.3.1` artifact. The full release gate also installs exact `maqam@0.2.4` in a separate clean consumer to preserve the older compatibility floor. Maintainers can point `MAQAM_PACKAGE_DIR` at another exact clean Maqam candidate for pre-release qualification, but a sibling checkout or filesystem dependency must never be committed or included in a release manifest.

See [Maqam and ProductLoop](./docs/maqam-and-productloop.md), [architecture](./docs/architecture.md), [comparison](./docs/comparison.md), [release process](./docs/releasing.md), and the [ecosystem launch runbook](./docs/launch-runbook.md).

## Open source and community

Start with the [community hub](https://maqamagent.com/community/) or [GitHub Discussions](https://github.com/AjnasNB/productloop-os/discussions) for questions, examples, and integration proposals. Actionable changes should arrive through a fork or branch and a reviewed pull request.

- [Contributing](./CONTRIBUTING.md)
- [Governance and maintainer roles](./GOVERNANCE.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Support](./SUPPORT.md)
- [Security policy](./SECURITY.md)

## Security and maturity

The packages make decisions and evidence inspectable, but they cannot make an unsafe tool safe. Enforce sandboxing, credential isolation, network controls, retention rules, and independent authorization at the actual execution boundary. Review manifests and dry-run tarballs before publishing.

This is an early `0.x` project. APIs can change between minor releases. A passing test suite demonstrates the covered deterministic behavior; it is not proof that every external integration or adversarial environment is safe.

## License

MIT
