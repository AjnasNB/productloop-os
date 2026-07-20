# Comparison and positioning

ProductLoop OS is closest to an in-process governance and evidence toolkit. It is not a drop-in replacement for a full crawler service, browser automation stack, model SDK, or durable workflow platform. The useful distinction is what each project treats as its primary abstraction.

The references below describe upstream projects as reviewed on 2026-07-20. Follow the source links for current behavior and licensing.

| Project | Primary abstraction | Strong fit | Important difference or boundary |
| --- | --- | --- | --- |
| [Maqam](https://maqamagent.com) | Governed execution kernel for policy-bound tools, exact approvals, and source-linked evidence | Applications that need approval and evidence attached to the input that actually executes | Early `0.x`; no hosted control plane; its crawler is HTTP/HTML-oriented rather than a full browser fleet |
| [ProductLoop OS](https://maqamagent.com/docs/productloop/) | Composable runtime, policy, approval, provenance, connector, skill, eval, and research packages around Maqam | Applications that want inspectable local primitives and control over providers | Keeps package contracts and ledgers explicit; no automatic interception of direct provider calls; deterministic replay is the only bundled browser-research adapter |
| [Agent Reach](https://github.com/Panniantong/Agent-Reach) | Capability installer, health checker, and routing guidance across upstream internet tools | Making broad public and authenticated information channels legible to shell-capable agents | Broader channel catalog; ProductLoop does not auto-install tools, extract cookies, or claim that those calls are governed |
| [Page Agent](https://github.com/alibaba/page-agent) | In-page natural-language GUI agent with optional extension and MCP surfaces | Low-friction form filling, navigation, accessibility, and browser control inside web applications | Provides a browser-action implementation; ProductLoop and Maqam provide adapter, policy, approval, and evidence contracts rather than bundling its driver |
| [Graphify](https://github.com/Graphify-Labs/graphify) | Multi-format project knowledge graph and assistant integration | Relationship-aware exploration and query across code, documents, schemas, and media | Much broader extraction and graph-analysis surface; Qarinah focuses on consented event history, evidence links, deterministic rebuilds, and bounded context packs |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Python browser crawler and scraper producing structured, model-ready content | Async crawling, browser sessions, extraction strategies, caching, proxies, hooks, and self-hosted browser control | Much deeper crawling/browser surface; it does not replace ProductLoop's cross-package policy, approval-ticket, connector-trust, release, and evidence schemas |
| [Firecrawl](https://github.com/firecrawl/firecrawl) | Hosted and self-hostable API for search, scrape, crawl, extract, and agent workflows | Web data API, SDK integrations, managed scale, and rich web extraction | Stronger web service and extraction surface; cloud and self-hosted feature sets can differ; its repository is AGPL-3.0 while ProductLoop OS and Maqam are MIT |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Low-level graph orchestration for long-running, stateful agents | Durable execution, state, memory, human-in-the-loop graph control, and deployment | Broader and more mature workflow orchestration; ProductLoop focuses on portable governance records and can wrap tools called from another orchestrator |

## When to combine them

A crawler or browser system can implement the `BrowserResearchAdapter` contract, while ProductLoop applies a plan policy, captures citations, produces audit receipts, and evaluates the resulting artifact. This is usually more credible than trying to reimplement every anti-bot, rendering, proxy, and extraction feature in the governance layer.

Likewise, a durable orchestrator can call ProductLoop-controlled tools or persist ProductLoop evidence alongside its own checkpoints. The packages do not require a specific model vendor.

## What "better" should mean here

ProductLoop OS should compete on inspectability, narrow interfaces, deterministic tests, package independence, and explicit high-risk boundaries. It should not claim superiority in crawl throughput, rendering fidelity, model quality, distributed durability, or connector breadth without benchmarks and production evidence.

No upstream code was copied into this workspace. The comparison is architectural inspiration and interoperability guidance; licenses and notices of any future imported code must be reviewed separately.

For the precise boundary between the two projects, see [Maqam and ProductLoop](./maqam-and-productloop.md).
