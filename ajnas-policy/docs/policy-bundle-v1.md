# Ajnas Policy Bundle V1

Schema version: `ajnas.policy.bundle.v1`

## Bundle Fields

- `id`: stable policy bundle id.
- `version`: bundle version.
- `description`: optional human-readable description.
- `owner`: optional owning team.
- `defaultEffect`: `allow` or `deny`.
- `rules`: array of policy rules.
- `metadata`: optional JSON metadata for compliance and ownership.

## Rule Fields

- `id`: unique rule id.
- `description`: optional rule description.
- `effect`: `allow`, `deny`, or `require_approval`.
- `reason`: reason returned to the runtime and audit log.
- `approvalPrompt`: optional prompt template used for `require_approval`.
- `priority`: optional numeric priority.
- `enabled`: optional boolean; `false` disables the rule.
- `match`: match criteria.

## Match Criteria

All criteria in a rule must match. Omitted criteria are ignored.

- `toolNames`: exact tool names.
- `toolNamePatterns`: glob-style names using `*` and `?`.
- `risks`: tool or metadata risks.
- `purposes`: metadata purpose values.
- `destinations`: input or metadata destination values.
- `dataClasses`: any input or metadata data class.
- `publishers`: input, trust, or metadata publisher values.
- `capabilities`: any input or metadata capability.
- `metadata`: exact top-level metadata values.
- `input`: exact top-level input values.

## Prompt Template Tokens

Approval prompts can include:

- `{toolName}`
- `{risk}`
- `{destination}`
- `{dataClasses}`
- `{publisher}`
- `{ruleId}`
- `{policyBundleId}`

Unknown tokens render as empty strings.
