# Architecture

`ajnas-policy` is split into small modules:

- `types.ts` defines the runtime-compatible request/decision contract, policy bundle schema, audit events, and approval queue records.
- `stable-json.ts` canonicalizes JSON and computes SHA-256 digests.
- `validation.ts` checks bundle structure, unique rules, valid effects, and non-empty match criteria.
- `evaluator.ts` extracts runtime context, matches rules, resolves precedence, renders approval prompts, and returns decisions.
- `audit.ts` records append-only decision events with replayable receipt chains.
- `approval-queue.ts` serializes human review requests for policy exceptions.
- `cli.ts` wraps validation, digest, and evaluation commands.

## Evaluation Model

Policy evaluation is deterministic:

1. Validate the bundle.
2. Extract tool name, risk, purpose, destination, data classes, publisher, and capabilities from the runtime request.
3. Match every enabled rule.
4. Select by effect severity: `deny`, then `require_approval`, then `allow`.
5. Use higher priority within the same effect.
6. Use bundle order as the final tie breaker.
7. Fall back to the bundle `defaultEffect` when no rule matches.

This makes the engine predictable for release gates and compliance review. The package intentionally avoids embedding a general-purpose programming language in policy files.

## Runtime Integration

`createDeclarativePolicyEngine()` returns an object with `evaluate(request)`, matching the Ajnas runtime policy hook. The peer dependency is optional so the package can be tested and used independently.

## Audit Integration

`PolicyDecisionLedger` can be attached to the engine. It stores the selected rule, all matched rules, runtime request digest, and chained receipt for every decision. The ledger can be exported as JSON and verified with `ledger.verify()`.
