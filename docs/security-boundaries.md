# Security boundaries

ProductLoop OS treats policy, approval, audit, and provenance payloads as JSON data, not arbitrary JavaScript object graphs.

## Canonical JSON

All package-local canonical JSON implementations use the same fail-closed rules:

- accepted values are `null`, booleans, strings, finite numbers other than negative zero, dense arrays, and plain objects;
- object keys are ordered by JavaScript string code-unit order, independent of process locale;
- normalized objects have a null prototype, so a `__proto__` key remains inert data;
- `undefined`, bigint, functions, symbols, non-finite numbers, negative zero, class instances, `Date`, `URL`, `Error`, `Map`, `Set`, typed arrays, accessors, hidden properties, symbol properties, sparse arrays, and arrays with extra properties are rejected;
- cycles and repeated object references are rejected instead of being silently flattened;
- inputs are limited to 64 levels, 100,000 nodes, and 8 MiB of UTF-8 string/key or serialized data.

Optional fields must be omitted before canonicalization. They are never silently converted to `null`. This prevents approval or artifact inputs such as `{ value: undefined }` from sharing a digest with `{ value: null }`.

These digests are deterministic for the supported JavaScript JSON model. They are not advertised as RFC 8785/JCS-compatible across other languages.

## Runtime and approvals

`AgentRuntime` denies every tool call when no policy engine is configured. A configured policy receives a cloned request, and each tool receives separately cloned JSON input and metadata. Call metadata may raise but never lower a tool's declared risk. Run IDs use a path-safe grammar, and one runtime instance permanently reserves every issued ID so concurrent or sequential reuse fails instead of overwriting persisted history.

For `require_approval`, the runtime computes a SHA-256 binding over the run ID, step ID, tool, risk, input, metadata, policy reason, and prompt. An approver must echo the exact `bindingDigest`; missing or mismatched values fail before tool execution. The `ajnas-approvals` runtime adapter records that binding in the review subject and verifies that the subject did not change while the ticket was resolved.

Queues, registries, in-memory provenance sinks, and audit ledgers clone values on ingress and egress. Mutating a submitted object or a returned snapshot does not mutate their internal state.

## Remaining host responsibilities

- The runtime coordinates trusted code; it is not a JavaScript sandbox. Run untrusted tools in a separate restricted process or service.
- Hash chains detect later changes when verified, but in-memory ledgers are not durable append-only storage and hashes are not signatures.
- Redaction recognizes sensitive key names such as tokens, passwords, credentials, cookies, sessions, authorization, and API/private keys. It cannot reliably discover secrets embedded in arbitrary free-form strings.
- JavaScript proxies can execute traps during object inspection. Parse untrusted wire input as JSON before passing it to these APIs; do not pass hostile live proxy objects.
- Persisted approval consumption and multi-process run-ID uniqueness require a transactional external store at deployment scale.
