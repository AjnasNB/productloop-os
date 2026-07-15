# Security

`ajnas-evals` is a local evaluation harness. It does not execute arbitrary shell commands, call external services, or publish data by itself.

## Data Handling

- Eval suites and artifacts are local JSON inputs.
- Reports include deterministic digests and may contain run evidence supplied by adapters.
- Sensitive data should be redacted by the adapter before it is placed in an `AgentRunArtifact`.

## Trust Boundaries

Adapters are responsible for executing workflows and collecting evidence. Treat adapter output as untrusted until assertions, report verification, and audit receipts have been reviewed.

## Reporting Issues

Do not include secrets, tokens, private traces, or unpublished customer data in issue reports. Include suite ids, assertion ids, package version, and minimal reproduction artifacts.
