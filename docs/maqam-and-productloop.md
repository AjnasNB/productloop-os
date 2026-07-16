# Maqam and ProductLoop OS

[Maqam](https://maqamagent.com) and ProductLoop OS are one open-source ecosystem with two distinct jobs.

| Layer | Job | Use it when |
| --- | --- | --- |
| Maqam | Governed execution kernel that binds policy, exact approvals, tool execution, and source-linked evidence | A side effect must execute through an approval- and evidence-aware gateway, or an application needs Maqam's workflow, CLI-agent, skill, or HTTP-crawler capabilities |
| ProductLoop packages | Composable surrounding capabilities for runtime orchestration, declarative policy, approval operations, provenance, connectors, skill manifests, evaluations, and browser-research records | An application wants small packages with explicit records and interfaces, independently or alongside Maqam |
| `productloop-os` | Umbrella package that exposes Maqam and all eight Ajnas namespaces, creates both subsystems, and supplies a small set of tested adapters | An application wants one install and a coordinated composition without hiding package boundaries |

## Which package to install

Install Maqam when the governed execution kernel is the primary requirement:

```sh
npm install maqam
```

Install the ProductLoop umbrella when the application needs Maqam plus the surrounding package ecosystem:

```sh
npm install productloop-os
```

Each Ajnas package can also be installed independently. The [package atlas](https://maqamagent.com/docs/productloop/) lists their responsibilities and copy-paste examples.

## What the umbrella actually composes

`createProductLoopOS()` creates an `ajnas-runtime` subsystem with ProductLoop policy, approval, skill, connector, browser-research, and provenance components. It also creates a separate Maqam policy engine, evidence ledger, approval queue, tool gateway, and runtime.

That separation is intentional. The two systems do not have identical contracts, and the umbrella does not pretend that one ledger is a distributed transaction over every other ledger.

The exported `createMaqamCrawlerTool()` is the explicit bridge from Maqam's live HTTP crawler into `ajnas-runtime`. The tool is marked high risk and is never registered automatically:

```js
import { createMaqamCrawlerTool, createProductLoopOS } from "productloop-os";

const os = createProductLoopOS();
const crawler = createMaqamCrawlerTool({
  defaults: { obeyRobots: true, maxPages: 10 }
});

os.tools.register(crawler);
```

The default ProductLoop policy denies tool calls. Registering this adapter does not authorize it: the application must supply an explicit policy and approval path before execution.

## Integration boundary

ProductLoop adapters convert documented records or tool shapes. They are not native integrations with every orchestrator, provider, browser, connector, model SDK, or hosted service.

A direct call outside the selected governed runtime bypasses that runtime's policy, approval, and evidence path. To preserve governance, the host application must route the real side effect through Maqam's gateway or a ProductLoop-registered tool, keep approval binding intact, and enforce network, process, filesystem, identity, credential, and sandbox controls where the effect actually occurs.

Likewise, importing events into a provenance ledger copies evidence; it does not create a distributed transaction. Durable delivery, retries, storage, and reconciliation remain deployment responsibilities.

## Project links

- [Maqam website and documentation](https://maqamagent.com)
- [ProductLoop package atlas](https://maqamagent.com/docs/productloop/)
- [Architecture](./architecture.md)
- [Comparison and positioning](./comparison.md)
- [Contributing](../CONTRIBUTING.md)
- [Governance](../GOVERNANCE.md)
- [Code of Conduct](../CODE_OF_CONDUCT.md)
- [Support](../SUPPORT.md)
- [Security policy](../SECURITY.md)
- [GitHub Discussions](https://github.com/AjnasNB/productloop-os/discussions)
