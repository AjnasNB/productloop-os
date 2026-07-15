# Provenance and License Notes

This package is original Ajnas work.

## OSS Context Used

No new public repositories were cloned or installed for this package run. Design direction used prior automation memory about permissive OSS patterns in skill registries, agent runtimes, policy gates, eval tools, and MCP ecosystems. That context included public projects such as Vercel skills CLI, UC Davis AI Skills Registry, MCP registry work, OpenAI/Codex tooling, LangGraph, promptfoo, and related MIT or Apache-2.0 agent infrastructure.

No third-party source code, docs, examples, branding, or assets were copied into this package.

## Ajnas License

`ajnas-skills-registry` is prepared under the MIT license.

## Runtime Dependency Posture

`ajnas-runtime` is declared as an optional peer dependency so the registry remains independently usable. The registry exposes structural policy contracts that preserve compatibility without coupling every installation to the runtime package.
