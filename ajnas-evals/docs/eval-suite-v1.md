# ajnas.eval.suite.v1

An eval suite is a JSON document with:

- `schemaVersion`: must be `ajnas.eval.suite.v1`.
- `id`: stable suite id.
- `version`: suite version.
- `cases`: one or more eval cases.

Each case has an `id`, optional `input`, and one or more assertions.

## Assertion Reference

`run.status`

```json
{ "id": "status", "kind": "run.status", "status": "waiting_for_approval" }
```

`json.path`

```json
{ "id": "package", "kind": "json.path", "path": "output.release.packageName", "equals": "ajnas-policy" }
```

`event.type.count`

```json
{ "id": "tool-event", "kind": "event.type.count", "eventType": "tool.requested", "min": 1 }
```

`policy.decision`

```json
{ "id": "policy", "kind": "policy.decision", "toolName": "npm.publish", "decision": "require_approval" }
```

`approval.status`

```json
{ "id": "approval", "kind": "approval.status", "toolName": "npm.publish", "status": "pending" }
```

`provenance.valid`

```json
{ "id": "trace", "kind": "provenance.valid", "valid": true }
```

`connector.trust`

```json
{ "id": "connector", "kind": "connector.trust", "connectorId": "npm", "trustTier": "verified" }
```

`browser.step`

```json
{ "id": "browser", "kind": "browser.step", "stepType": "inspect", "urlHost": "npmjs.com", "status": "passed" }
```
