# Comparison and positioning

ProductLoop OS is closest to an in-process governance and evidence toolkit. It is not a drop-in replacement for a full crawler service, browser automation stack, model SDK, or durable workflow platform. The useful distinction is what each project treats as its primary abstraction.

The references below describe upstream projects as reviewed on 2026-07-15. Follow the source links for current behavior and licensing.

| Project | Primary abstraction | Strong fit | Different from ProductLoop OS |
| --- | --- | --- | --- |
| ProductLoop OS / Maqam | Governed workflow plus policy, approvals, evidence, manifests, evals, and explicit tool adapters | Applications that want auditable local primitives and control over providers | Early `0.x`; no hosted control plane; replay is the only bundled browser-research adapter; Maqam's crawler is HTTP/HTML-oriented rather than a full browser fleet |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Python browser crawler and scraper producing structured, model-ready content | Async crawling, browser sessions, extraction strategies, caching, proxies, hooks, and self-hosted browser control | Much deeper crawling/browser surface; it does not replace ProductLoop's cross-package policy, approval-ticket, connector-trust, release, and evidence schemas |
| [Firecrawl](https://github.com/firecrawl/firecrawl) | Hosted and self-hostable API for search, scrape, crawl, extract, and agent workflows | Web data API, SDK integrations, managed scale, and rich web extraction | Stronger web service and extraction surface; cloud and self-hosted feature sets can differ; its repository is AGPL-3.0 while ProductLoop OS and Maqam are MIT |
| [LangGraph](https://github.com/langchain-ai/langgraph) | Low-level graph orchestration for long-running, stateful agents | Durable execution, state, memory, human-in-the-loop graph control, and deployment | Broader and more mature workflow orchestration; ProductLoop focuses on portable governance records and can wrap tools called from another orchestrator |

## When to combine them

A crawler or browser system can implement the `BrowserResearchAdapter` contract, while ProductLoop applies a plan policy, captures citations, produces audit receipts, and evaluates the resulting artifact. This is usually more credible than trying to reimplement every anti-bot, rendering, proxy, and extraction feature in the governance layer.

Likewise, a durable orchestrator can call ProductLoop-controlled tools or persist ProductLoop evidence alongside its own checkpoints. The packages do not require a specific model vendor.

## What “better” should mean here

ProductLoop OS should compete on inspectability, narrow interfaces, deterministic tests, package independence, and explicit high-risk boundaries. It should not claim superiority in crawl throughput, rendering fidelity, model quality, distributed durability, or connector breadth without benchmarks and production evidence.

No upstream code was copied into this workspace. The comparison is architectural inspiration and interoperability guidance; licenses and notices of any future imported code must be reviewed separately.
