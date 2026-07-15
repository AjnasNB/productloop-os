import { sha256Digest, toJsonObject } from "./stable-json.js";
import { PERMISSIVE_LICENSES, computeConnectorDigest, maxRisk, riskAtLeast, validateConnectorManifest } from "./validation.js";
import type {
  ConnectorCapability,
  ConnectorDataClass,
  ConnectorInvocationRequest,
  ConnectorManifest,
  ConnectorOperation,
  ConnectorPolicySelector,
  ConnectorRisk,
  ConnectorTrustEvaluation,
  ConnectorTrustEvaluationOptions,
  ConnectorTrustPolicy,
  JsonObject,
  RuntimePolicyDecision,
  RuntimePolicyRequest
} from "./types.js";

const DEFAULT_APPROVAL_OPERATIONS: ConnectorOperation[] = ["write", "publish", "delete"];
const DEFAULT_APPROVAL_RISKS: ConnectorRisk[] = ["high", "critical"];
const SECRET_DATA_CLASSES: ConnectorDataClass[] = ["credential", "secret"];

export function createConnectorPolicyRequest(manifest: ConnectorManifest, invocation: ConnectorInvocationRequest): RuntimePolicyRequest {
  if (invocation.connectorId !== manifest.id) {
    throw new Error(`Invocation connectorId ${invocation.connectorId} does not match manifest ${manifest.id}.`);
  }

  const capability = findCapability(manifest, invocation.capabilityId);
  if (!capability) {
    throw new Error(`Capability ${invocation.capabilityId} is not declared by connector ${manifest.id}.`);
  }

  if (!capability.operations.includes(invocation.operation)) {
    throw new Error(`Capability ${capability.id} does not allow operation ${invocation.operation}.`);
  }

  const trust = evaluateConnectorTrust(manifest, { request: invocation });

  return {
    runId: invocation.runId,
    stepId: invocation.stepId,
    tool: {
      name: `connector:${manifest.id}:${capability.id}:${invocation.operation}`,
      description: capability.description,
      risk: capability.risk
    },
    input: invocation.input,
    metadata: toJsonObject({
      connector: {
        id: manifest.id,
        version: manifest.version,
        kind: manifest.kind,
        name: manifest.name,
        publisher: manifest.publisher,
        capabilityId: capability.id,
        operation: invocation.operation,
        purpose: invocation.purpose,
        requestedBy: invocation.requestedBy ?? null,
        dataClasses: capability.dataClasses,
        destinations: capability.destinations,
        authType: manifest.auth.type,
        trustReviewStatus: manifest.trust.reviewStatus,
        trustDecision: trust.decision,
        manifestDigest: trust.manifestDigest,
        requestDigest: sha256Digest(invocation),
        license: manifest.trust.license
      },
      userMetadata: invocation.metadata ?? {}
    })
  };
}

export function evaluateConnectorTrust(manifest: ConnectorManifest, options: ConnectorTrustEvaluationOptions = {}): ConnectorTrustEvaluation {
  const validation = validateConnectorManifest(manifest);
  const request = options.request ?? {};
  const policy = options.policy ?? {};
  const manifestDigest = computeConnectorDigest(manifest);
  const capability = request.capabilityId ? findCapability(manifest, request.capabilityId) : undefined;
  const operation = request.operation ?? firstOperation(capability, manifest);
  const risk = capability?.risk ?? maxRisk([...manifest.permissions.map((permission) => permission.risk), ...manifest.capabilities.map((item) => item.risk)]);
  const dataClasses = unique(capability?.dataClasses ?? manifest.permissions.flatMap((permission) => permission.dataClasses));
  const destinations = unique(capability?.destinations ?? manifest.permissions.flatMap((permission) => permission.destinations));
  const denyReasons: string[] = [];
  const approvalReasons: string[] = [];

  if (!validation.valid) {
    denyReasons.push(`Manifest failed validation with ${validation.issues.length} issue(s).`);
  }

  const allowedLicenses = policy.allowedLicenses ?? [...PERMISSIVE_LICENSES];
  if (!allowedLicenses.includes(manifest.trust.license)) {
    denyReasons.push(`License ${manifest.trust.license} is not in the allowed license list.`);
  }

  if (manifest.trust.reviewStatus === "blocked") {
    denyReasons.push("Connector trust review status is blocked.");
  }

  if (operation && policy.blockedOperations?.includes(operation)) {
    denyReasons.push(`Operation ${operation} is blocked by trust policy.`);
  }

  const blockedDataClass = firstIntersection(dataClasses, policy.blockedDataClasses ?? []);
  if (blockedDataClass) {
    denyReasons.push(`Data class ${blockedDataClass} is blocked by trust policy.`);
  }

  if (policy.allowedDestinations && destinations.some((destination) => !policy.allowedDestinations?.includes(destination))) {
    approvalReasons.push("Connector uses a destination outside the explicit allowed destination list.");
  }

  if (policy.requireSourceUrl && !manifest.trust.sourceUrl) {
    approvalReasons.push("Connector source URL is required by trust policy.");
  }

  if (manifest.trust.reviewStatus === "unreviewed") {
    approvalReasons.push("Connector has not been reviewed.");
  }

  if (operation && (policy.requireApprovalForOperations ?? DEFAULT_APPROVAL_OPERATIONS).includes(operation)) {
    approvalReasons.push(`Operation ${operation} requires approval.`);
  }

  if ((policy.requireReviewForRisks ?? DEFAULT_APPROVAL_RISKS).some((minimum) => riskAtLeast(risk, minimum))) {
    approvalReasons.push(`Risk ${risk} requires human review.`);
  }

  if (firstIntersection(dataClasses, SECRET_DATA_CLASSES)) {
    approvalReasons.push("Connector can process credential or secret data.");
  }

  if (capability?.requiresApproval) {
    approvalReasons.push(`Capability ${capability.id} declares requiresApproval.`);
  }

  if (matchesSelector(manifest.policyHints?.deniedFor, capability, operation, dataClasses, destinations, risk)) {
    denyReasons.push("Connector policy hints mark this request as denied.");
  }

  if (matchesSelector(manifest.policyHints?.approvalRequiredFor, capability, operation, dataClasses, destinations, risk)) {
    approvalReasons.push("Connector policy hints require approval for this request.");
  }

  const decision = denyReasons.length > 0 ? "deny" : approvalReasons.length > 0 ? "require_approval" : "allow";
  const reasons = denyReasons.length > 0 ? denyReasons : approvalReasons.length > 0 ? unique(approvalReasons) : ["Connector trust policy allowed this request."];

  return {
    decision,
    reasons,
    ...(decision === "require_approval"
      ? { approvalPrompt: `Review connector ${manifest.id}@${manifest.version} before ${operation ?? "use"} for ${request.purpose ?? manifest.policyHints?.defaultPurpose ?? "unspecified purpose"}.` }
      : {}),
    manifestDigest,
    connectorId: manifest.id,
    connectorVersion: manifest.version,
    risk,
    ...(operation === undefined ? {} : { operation }),
    ...((capability?.id ?? request.capabilityId) === undefined ? {} : { capabilityId: capability?.id ?? request.capabilityId }),
    dataClasses,
    destinations,
    metadata: toJsonObject({
      reviewStatus: manifest.trust.reviewStatus,
      license: manifest.trust.license,
      sourceUrl: manifest.trust.sourceUrl ?? null,
      policy: {
        requireSourceUrl: policy.requireSourceUrl ?? false,
        allowedLicenses
      }
    })
  };
}

export function connectorTrustDecisionToRuntimeDecision(evaluation: ConnectorTrustEvaluation): RuntimePolicyDecision {
  if (evaluation.decision === "allow") {
    return {
      decision: "allow",
      reason: evaluation.reasons.join(" "),
      metadata: evaluation.metadata
    };
  }

  if (evaluation.decision === "deny") {
    return {
      decision: "deny",
      reason: evaluation.reasons.join(" "),
      metadata: evaluation.metadata
    };
  }

  return {
    decision: "require_approval",
    reason: evaluation.reasons.join(" "),
    approvalPrompt: evaluation.approvalPrompt,
    metadata: evaluation.metadata
  };
}

function findCapability(manifest: ConnectorManifest, capabilityId: string): ConnectorCapability | undefined {
  return manifest.capabilities.find((capability) => capability.id === capabilityId);
}

function firstOperation(capability: ConnectorCapability | undefined, manifest: ConnectorManifest): ConnectorOperation | undefined {
  return capability?.operations[0] ?? manifest.permissions[0]?.operations[0];
}

function matchesSelector(
  selector: ConnectorPolicySelector | undefined,
  capability: ConnectorCapability | undefined,
  operation: ConnectorOperation | undefined,
  dataClasses: ConnectorDataClass[],
  destinations: string[],
  risk: ConnectorRisk
): boolean {
  if (!selector) {
    return false;
  }

  const checks: boolean[] = [];
  if (selector.operations && operation) {
    checks.push(selector.operations.includes(operation));
  }
  if (selector.capabilities && capability) {
    checks.push(selector.capabilities.includes(capability.id));
  }
  if (selector.dataClasses) {
    checks.push(Boolean(firstIntersection(dataClasses, selector.dataClasses)));
  }
  if (selector.destinations) {
    checks.push(Boolean(firstIntersection(destinations, selector.destinations)));
  }
  if (selector.risks) {
    checks.push(selector.risks.includes(risk));
  }
  return checks.length > 0 && checks.every(Boolean);
}

function firstIntersection<T>(left: T[], right: T[]): T | undefined {
  return left.find((item) => right.includes(item));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
