import { readFileSync } from "node:fs";
import {
  ConnectorApprovalQueue,
  ConnectorAuditLedger,
  ConnectorRegistry,
  createConnectorPolicyRequest,
  evaluateConnectorTrust
} from "../dist/index.js";

const manifest = JSON.parse(readFileSync(new URL("../fixtures/enterprise-release-publisher.connector.json", import.meta.url), "utf8"));
const invocation = JSON.parse(readFileSync(new URL("../fixtures/publish-invocation.json", import.meta.url), "utf8"));
const clock = () => new Date("2026-07-11T06:30:00.000Z");
const audit = new ConnectorAuditLedger({ clock });
const registry = new ConnectorRegistry({ audit });
const approvals = new ConnectorApprovalQueue({ clock });

registry.register(manifest, { actorId: "release-engineer" });
const policyRequest = createConnectorPolicyRequest(manifest, invocation);
const trust = evaluateConnectorTrust(manifest, { request: invocation });

let approvalRequest = null;
if (trust.decision === "require_approval") {
  approvalRequest = approvals.request({
    manifest,
    invocation,
    trustEvaluation: trust,
    reason: trust.reasons.join(" "),
    requestedBy: invocation.requestedBy
  });
}

console.log(
  JSON.stringify(
    {
      connectorId: manifest.id,
      policyTool: policyRequest.tool.name,
      trustDecision: trust.decision,
      approvalStatus: approvalRequest?.status ?? "not_required",
      auditValid: audit.verify().valid
    },
    null,
    2
  )
);
