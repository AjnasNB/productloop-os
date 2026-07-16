# ProductLoop OS

ProductLoop OS is a TypeScript workspace for policy-gated agent workflows. It composes small, independently publishable packages for runtime execution, policy decisions, human approvals, connector trust, skill manifests, evidence provenance, deterministic evaluations, and browser-research records.

The project is a governance toolkit, not a claim of autonomous intelligence. It does not ship a model, a hosted control plane, a secret manager, a production browser, or a distributed job system. Maqam supplies a higher-level governed agent framework and a crawler; `ajnas-browser-research` supplies a governed adapter contract and deterministic replay harness. Real browser, search, connector, model, and storage implementations remain explicit deployment choices.

## Packages

| Package | Release | Responsibility |
| --- | ---: | --- |
| [`productloop-os`](./productloop-os) | `0.2.0` | One install, named namespaces, tested adapters, and composition helpers |
| [`maqam`](https://github.com/AjnasNB/maqam) | `0.2.2` | Governed workflows, CLI-agent tools, evidence, skills, and crawler-backed research |
| [`ajnas-runtime`](./ajnas-runtime) | `0.2.0` | Ordered workflows and policy-gated tool calls |
| [`ajnas-policy`](./ajnas-policy) | `0.1.1` | Declarative allow, deny, and approval decisions |
| [`ajnas-approvals`](./ajnas-approvals) | `0.1.1` | Human review tickets, delegation, escalation, and audit history |
| [`ajnas-provenance`](./ajnas-provenance) | `0.1.2` | Hash-linked traces, bundles, signatures, and redaction |
| [`ajnas-skills-registry`](./ajnas-skills-registry) | `0.2.0` | Signed skill manifests and install policy |
| [`ajnas-connectors`](./ajnas-connectors) | `0.1.1` | Connector manifests, permissions, and trust evaluation |
| [`ajnas-evals`](./ajnas-evals) | `0.1.1` | Deterministic assertions and verifiable evaluation reports |
| [`ajnas-browser-research`](./ajnas-browser-research) | `0.1.2` | Policy-aware research plans, replay adapters, citations, and evidence exports |

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

Node.js 20.18.1 or newer is required by the current Maqam dependency.

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run integration
npm run pack
```

Maqam `^0.2.2` is the supported crawler floor, and the canonical workspace lockfile resolves it from the public registry. Local development and release verification must not commit a sibling checkout or filesystem link in place of that registry dependency.

See [architecture](./docs/architecture.md), [comparison](./docs/comparison.md), and [release process](./docs/releasing.md).

## Security and maturity

The packages make decisions and evidence inspectable, but they cannot make an unsafe tool safe. Enforce sandboxing, credential isolation, network controls, retention rules, and independent authorization at the actual execution boundary. Review manifests and dry-run tarballs before publishing.

This is an early `0.x` project. APIs can change between minor releases. A passing test suite demonstrates the covered deterministic behavior; it is not proof that every external integration or adversarial environment is safe.

## License

MIT
