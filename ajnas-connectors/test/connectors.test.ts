import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  ConnectorApprovalQueue,
  ConnectorAuditLedger,
  ConnectorRegistry,
  computeConnectorDigest,
  connectorTrustDecisionToRuntimeDecision,
  createConnectorPolicyRequest,
  evaluateConnectorTrust,
  validateConnectorManifest
} from "../src/index.js";
import type { ConnectorInvocationRequest, ConnectorManifest } from "../src/index.js";

const fixedClock = () => new Date("2026-07-11T06:30:00.000Z");

function loadManifest(): ConnectorManifest {
  return JSON.parse(readFileSync("fixtures/enterprise-release-publisher.connector.json", "utf8")) as ConnectorManifest;
}

function loadInvocation(): ConnectorInvocationRequest {
  return JSON.parse(readFileSync("fixtures/publish-invocation.json", "utf8")) as ConnectorInvocationRequest;
}

describe("connector manifests", () => {
  test("validates connector manifests and computes deterministic digests", () => {
    const manifest = loadManifest();

    expect(validateConnectorManifest(manifest)).toEqual({ valid: true, issues: [] });

    const digest = computeConnectorDigest(manifest);
    expect(digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(computeConnectorDigest({ ...manifest })).toBe(digest);
  });

  test("rejects duplicate permissions and unsafe publish capabilities", () => {
    const manifest = loadManifest();
    const invalid = structuredClone(manifest);
    invalid.permissions[1].id = invalid.permissions[0].id;
    invalid.capabilities[1].requiresApproval = false;

    const result = validateConnectorManifest(invalid);

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("PERMISSION_ID_DUPLICATE");
    expect(result.issues.map((issue) => issue.code)).toContain("CAPABILITY_APPROVAL_REQUIRED");
  });

  test("creates runtime policy context for connector invocations", () => {
    const manifest = loadManifest();
    const invocation = loadInvocation();

    const request = createConnectorPolicyRequest(manifest, invocation);

    expect(request.tool).toMatchObject({
      name: "connector:com.ajnas.connectors.release-publisher:npm.publish.approved:publish",
      risk: "high"
    });
    expect(request.metadata.connector).toMatchObject({
      id: manifest.id,
      version: manifest.version,
      capabilityId: invocation.capabilityId,
      operation: invocation.operation,
      trustDecision: "require_approval"
    });
  });

  test("evaluates connector trust with human approval gates", () => {
    const manifest = loadManifest();
    const invocation = loadInvocation();

    const evaluation = evaluateConnectorTrust(manifest, { request: invocation });
    const runtimeDecision = connectorTrustDecisionToRuntimeDecision(evaluation);

    expect(evaluation.decision).toBe("require_approval");
    expect(evaluation.reasons.join(" ")).toContain("Operation publish requires approval");
    expect(evaluation.approvalPrompt).toContain(manifest.id);
    expect(runtimeDecision.decision).toBe("require_approval");
  });

  test("blocks non-permissive connector manifests", () => {
    const manifest = loadManifest();
    manifest.trust.license = "GPL-3.0-only";

    const validation = validateConnectorManifest(manifest);
    const evaluation = evaluateConnectorTrust(manifest);

    expect(validation.valid).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain("LICENSE_NOT_PERMISSIVE");
    expect(evaluation.decision).toBe("deny");
  });
});

describe("connector registry and approvals", () => {
  test("registers connectors, records audit receipts, and filters by capability", () => {
    const manifest = loadManifest();
    const invocation = loadInvocation();
    const audit = new ConnectorAuditLedger({ clock: fixedClock });
    const registry = new ConnectorRegistry({ audit });

    registry.register(manifest, { actorId: "release-engineer" });
    const listed = registry.list({ operation: "publish", destination: "registry.npmjs.org" });
    const policyRequest = registry.createPolicyRequest(invocation);
    const trust = registry.evaluateTrust(manifest.id, { request: invocation });

    expect(listed.map((item) => item.id)).toEqual([manifest.id]);
    expect(policyRequest.metadata.connector).toMatchObject({ manifestDigest: computeConnectorDigest(manifest) });
    expect(trust.decision).toBe("require_approval");
    expect(audit.events).toHaveLength(3);
    expect(audit.verify()).toEqual({ valid: true, issues: [] });
  });

  test("tracks connector approval requests through resolution", () => {
    const manifest = loadManifest();
    const invocation = loadInvocation();
    const trust = evaluateConnectorTrust(manifest, { request: invocation });
    const queue = new ConnectorApprovalQueue({ clock: fixedClock });

    const request = queue.request({
      manifest,
      invocation,
      trustEvaluation: trust,
      reason: "External package publishing requires approval.",
      requestedBy: "release-engineer"
    });
    const resolved = queue.resolve(request.id, {
      approved: true,
      approverId: "owner",
      comment: "Approved for dry-run validated release candidate."
    });

    expect(request.status).toBe("pending");
    expect(resolved.status).toBe("approved");
    expect(queue.list("approved")).toHaveLength(1);
    expect(queue.list("pending")).toHaveLength(0);
  });
});
