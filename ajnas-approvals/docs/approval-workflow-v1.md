# Approval Workflow V1

Workflow documents use schema version `ajnas.approval.workflow.v1`.

## Required Fields

- `id`: stable workflow id.
- `version`: workflow version.
- `name`: display name for review surfaces.
- `owner`: owning team or system.
- `stages`: ordered approval stages.

## Stage Fields

- `id`: stable stage id.
- `name`: display name.
- `reviewers`: user, group, or role reviewers.
- `quorum`: one of `any`, `all`, `majority`, or `count`.
- `escalation`: optional overdue rule with `afterHours`, `notify`, and optional target `stageId`.

## Policy Fields

- `defaultTtlHours`: ticket expiry window.
- `requireReasonForRejection`: rejection comments are mandatory.
- `preventRequesterSelfApproval`: requester cannot approve their own ticket.
- `maxDelegationDepth`: maximum delegated reviewers per stage.
- `allowedRiskLevels`: risks accepted by this workflow.
- `sensitiveDataClasses`: data classes that review surfaces should highlight.

## Approval Subjects

Subjects describe the action being reviewed. Supported `kind` values:

- `runtime-tool`
- `connector-invocation`
- `package-release`
- `policy-exception`
- `provenance-export`
- `custom`

Subjects include `risk`, `requestedAction`, destinations, data classes, artifact digests, and metadata. The package validates subject shape but does not verify external artifacts; host systems should verify provenance and package checksums before review.
