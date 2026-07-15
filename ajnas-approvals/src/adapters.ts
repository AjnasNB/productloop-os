import { toJsonObject } from "./stable-json.js";
import type {
  ApprovalRisk,
  ApprovalSubject,
  ApprovalTicket,
  ConnectorTrustEvaluationLike,
  JsonObject,
  ReleaseApprovalSubjectInput,
  RuntimePolicyDecision,
  RuntimePolicyRequest
} from "./types.js";

const RISK_ORDER: ApprovalRisk[] = ["low", "medium", "high", "critical"];

export function createApprovalSubjectFromPolicyDecision(
  request: RuntimePolicyRequest,
  decision: RuntimePolicyDecision,
  options: { title?: string; summary?: string; destinations?: string[]; dataClasses?: string[]; metadata?: JsonObject } = {}
): ApprovalSubject {
  const metadata = {
    runId: request.runId,
    stepId: request.stepId,
    policyDecision: decision.decision,
    policyReason: decision.reason,
    ...(request.metadata ?? {}),
    ...(options.metadata ?? {})
  };
  return {
    id: `policy-${request.runId}-${request.stepId}-${request.tool.name}`,
    kind: "runtime-tool",
    title: options.title ?? `Review ${request.tool.name}`,
    summary: options.summary ?? decision.reason,
    risk: normalizeRisk(request.tool.risk, "high"),
    requestedAction: request.tool.name,
    ...optionalArray("destinations", options.destinations ?? stringArrayFromMetadata(request.metadata, "destinations")),
    ...optionalArray("dataClasses", options.dataClasses ?? stringArrayFromMetadata(request.metadata, "dataClasses")),
    ...optionalArray("artifactDigests", stringArrayFromMetadata(request.metadata, "artifactDigests")),
    metadata: toJsonObject(metadata)
  };
}

export function createApprovalSubjectFromConnectorTrust(
  evaluation: ConnectorTrustEvaluationLike,
  options: { title?: string; summary?: string; requestedAction?: string; metadata?: JsonObject } = {}
): ApprovalSubject {
  const summary = options.summary ?? evaluation.approvalPrompt ?? evaluation.reasons?.join(" ") ?? `Review connector ${evaluation.connectorId}.`;
  return {
    id: `connector-${evaluation.connectorId}-${evaluation.capabilityId ?? "request"}`,
    kind: "connector-invocation",
    title: options.title ?? `Review connector ${evaluation.connectorId}`,
    summary,
    risk: normalizeRisk(evaluation.risk, "high"),
    requestedAction: options.requestedAction ?? evaluation.operation ?? "connector.invoke",
    ...optionalArray("destinations", evaluation.destinations),
    ...optionalArray("dataClasses", evaluation.dataClasses),
    ...optionalArray("artifactDigests", evaluation.manifestDigest ? [evaluation.manifestDigest] : undefined),
    metadata: toJsonObject({
      connectorId: evaluation.connectorId,
      connectorVersion: evaluation.connectorVersion ?? null,
      decision: evaluation.decision,
      capabilityId: evaluation.capabilityId ?? null,
      ...(evaluation.metadata ?? {}),
      ...(options.metadata ?? {})
    })
  };
}

export function createReleaseApprovalSubject(input: ReleaseApprovalSubjectInput): ApprovalSubject {
  return {
    id: `release-${input.packageName}-${input.version}`,
    kind: "package-release",
    title: `Release ${input.packageName}@${input.version}`,
    summary: input.changeSummary,
    risk: input.risk ?? "critical",
    requestedAction: input.requestedAction ?? "package.publish",
    destinations: input.destinations ?? ["npm"],
    dataClasses: ["release-artifact", "package-metadata"],
    ...optionalArray("artifactDigests", input.artifactDigests),
    metadata: toJsonObject({
      packageName: input.packageName,
      version: input.version,
      ...(input.metadata ?? {})
    })
  };
}

export function createRuntimeDecisionFromApprovalTicket(ticket: ApprovalTicket): RuntimePolicyDecision {
  if (ticket.status === "approved") {
    return {
      decision: "allow",
      reason: `Approval ticket ${ticket.id} was approved.`,
      metadata: { approvalTicketId: ticket.id, approvalStatus: ticket.status }
    };
  }
  if (["rejected", "expired", "cancelled"].includes(ticket.status)) {
    return {
      decision: "deny",
      reason: `Approval ticket ${ticket.id} is ${ticket.status}.`,
      metadata: { approvalTicketId: ticket.id, approvalStatus: ticket.status }
    };
  }
  return {
    decision: "require_approval",
    reason: `Approval ticket ${ticket.id} is ${ticket.status}.`,
    approvalPrompt: ticket.subject.summary,
    metadata: { approvalTicketId: ticket.id, approvalStatus: ticket.status, approvalStageId: ticket.stageId }
  };
}

function normalizeRisk(value: string | undefined, fallback: ApprovalRisk): ApprovalRisk {
  return RISK_ORDER.includes(value as ApprovalRisk) ? (value as ApprovalRisk) : fallback;
}

function stringArrayFromMetadata(metadata: JsonObject | undefined, key: string): string[] | undefined {
  const value = metadata?.[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : undefined;
}

function optionalArray<Key extends "destinations" | "dataClasses" | "artifactDigests">(
  key: Key,
  value: string[] | undefined
): Partial<Record<Key, string[]>> {
  return value === undefined ? {} : { [key]: [...value] } as Record<Key, string[]>;
}
