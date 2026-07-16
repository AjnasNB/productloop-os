import { computeApprovalSubjectDigest, computeApprovalWorkflowDigest, validateApprovalSubject, validateApprovalWorkflow } from "./validation.js";
import { sha256Digest, sha256Hex, stableJson, toJsonObject } from "./stable-json.js";
import type {
  ApprovalCancelInput,
  ApprovalDelegationInput,
  ApprovalDelegationRecord,
  ApprovalDecisionRecord,
  ApprovalHistoryEvent,
  ApprovalRequestInput,
  ApprovalReviewInput,
  ApprovalReviewer,
  ApprovalStage,
  ApprovalTicket,
  ApprovalTicketStatus,
  ApprovalWorkflow,
  JsonObject
} from "./types.js";

export function createApprovalTicket(input: ApprovalRequestInput): ApprovalTicket {
  assertRequestInput(input);
  assertValidWorkflow(input.workflow);
  assertValidSubject(input.subject);
  assertRiskAllowed(input.workflow, input.subject.risk);

  const createdAt = toIso(input.createdAt ?? new Date());
  const workflowDigest = computeApprovalWorkflowDigest(input.workflow);
  const subjectDigest = computeApprovalSubjectDigest(input.subject);
  const firstStage = input.workflow.stages[0];
  const expiresAt = input.workflow.policy?.defaultTtlHours
    ? addHours(createdAt, input.workflow.policy.defaultTtlHours).toISOString()
    : undefined;
  const seed = stableJson({
    workflowDigest,
    subjectDigest,
    requestedBy: input.requestedBy,
    reason: input.reason,
    createdAt
  });
  const id = `approval-${sha256Hex(seed).slice(0, 20)}`;
  const ticket: ApprovalTicket = {
    schemaVersion: "ajnas.approval.ticket.v1",
    id,
    workflowId: input.workflow.id,
    workflowVersion: input.workflow.version,
    workflowDigest,
    status: "pending",
    stageId: firstStage.id,
    stageStartedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
    ...(expiresAt === undefined ? {} : { expiresAt }),
    requestedBy: input.requestedBy,
    reason: input.reason,
    subject: toJsonObject(input.subject) as unknown as ApprovalTicket["subject"],
    ...(input.policyDecision === undefined ? {} : { policyDecision: toJsonObject(input.policyDecision) as unknown as ApprovalTicket["policyDecision"] }),
    ...(input.connectorTrust === undefined ? {} : { connectorTrust: toJsonObject(input.connectorTrust) as unknown as ApprovalTicket["connectorTrust"] }),
    ...(input.provenance === undefined ? {} : { provenance: toJsonObject(input.provenance) }),
    decisions: [],
    delegations: [],
    history: [
      historyEvent(1, createdAt, "approval.requested", input.requestedBy, firstStage.id, "pending", "Approval requested.", {
        workflowDigest,
        subjectDigest
      })
    ],
    ...(input.metadata === undefined ? {} : { metadata: toJsonObject(input.metadata) })
  };
  return ticket;
}

export function reviewApprovalTicket(workflow: ApprovalWorkflow, ticket: ApprovalTicket, input: ApprovalReviewInput): ApprovalTicket {
  assertTicketCanChange(workflow, ticket);
  assertReviewInput(input);
  const reviewedAt = toIso(input.reviewedAt ?? new Date());
  const stage = getStage(workflow, ticket.stageId);
  const reviewer = getAuthorizedReviewer(ticket, stage, input.reviewerId);

  if (workflow.policy?.preventRequesterSelfApproval && input.reviewerId === ticket.requestedBy && input.decision === "approve") {
    throw new Error("Requester self-approval is blocked by workflow policy.");
  }
  if (workflow.policy?.requireReasonForRejection && input.decision === "reject" && !input.comment) {
    throw new Error("Rejection requires a reviewer comment.");
  }
  if (ticket.decisions.some((decision) => decision.stageId === ticket.stageId && decision.reviewerId === input.reviewerId)) {
    throw new Error(`Reviewer ${input.reviewerId} has already decided on stage ${ticket.stageId}.`);
  }

  const decisionRecord: ApprovalDecisionRecord = {
    reviewerId: reviewer.id,
    decision: input.decision === "approve" ? "approved" : "rejected",
    stageId: ticket.stageId,
    decidedAt: reviewedAt,
    ...(input.comment === undefined ? {} : { comment: input.comment }),
    ...(input.metadata === undefined ? {} : { metadata: toJsonObject(input.metadata) })
  };
  const decisions = [...ticket.decisions, decisionRecord];
  const reviewedTicket = appendHistory(
    {
      ...ticket,
      decisions,
      updatedAt: reviewedAt,
      status: input.decision === "reject" ? "rejected" : ticket.status
    },
    reviewedAt,
    "approval.reviewed",
    input.reviewerId,
    ticket.stageId,
    input.decision === "reject" ? "rejected" : ticket.status,
    input.decision === "reject" ? "Approval rejected." : "Approval review recorded.",
    input.metadata
  );

  if (input.decision === "reject") {
    return reviewedTicket;
  }

  const approvalsInStage = decisions.filter((decision) => decision.stageId === ticket.stageId && decision.decision === "approved").length;
  if (approvalsInStage < requiredApprovalCount(stage, ticket)) {
    return reviewedTicket;
  }

  const currentStageIndex = workflow.stages.findIndex((candidate) => candidate.id === ticket.stageId);
  const nextStage = workflow.stages[currentStageIndex + 1];
  if (nextStage) {
    return appendHistory(
      {
        ...reviewedTicket,
        status: "pending",
        stageId: nextStage.id,
        stageStartedAt: reviewedAt,
        updatedAt: reviewedAt
      },
      reviewedAt,
      "approval.stage_advanced",
      input.reviewerId,
      nextStage.id,
      "pending",
      `Advanced to stage ${nextStage.id}.`,
      { previousStageId: ticket.stageId }
    );
  }

  return {
    ...reviewedTicket,
    status: "approved",
    updatedAt: reviewedAt,
    history: [
      ...reviewedTicket.history,
      historyEvent(
        reviewedTicket.history.length + 1,
        reviewedAt,
        "approval.stage_advanced",
        input.reviewerId,
        ticket.stageId,
        "approved",
        "Approval workflow completed.",
        { finalStageId: ticket.stageId }
      )
    ]
  };
}

function assertReviewInput(input: unknown): asserts input is ApprovalReviewInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Approval review input must be a JSON object.");
  const value = input as Record<string, unknown>;
  if (typeof value.reviewerId !== "string" || !value.reviewerId.trim()) throw new TypeError("Approval reviewerId must be a non-empty string.");
  if (value.decision !== "approve" && value.decision !== "reject") throw new TypeError("Approval decision must be approve or reject.");
  if (value.comment !== undefined && typeof value.comment !== "string") throw new TypeError("Approval comment must be a string.");
  assertOptionalTimestamp(value.reviewedAt, "Approval reviewedAt");
  if (value.metadata !== undefined) {
    if (value.metadata === null || typeof value.metadata !== "object" || Array.isArray(value.metadata)) throw new TypeError("Approval metadata must be a JSON object.");
    toJsonObject(value.metadata);
  }
}

function assertRequestInput(input: unknown): asserts input is ApprovalRequestInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Approval request input must be a JSON object.");
  const value = input as Record<string, unknown>;
  assertNonEmptyString(value.requestedBy, "Approval requestedBy");
  assertNonEmptyString(value.reason, "Approval reason");
  assertOptionalTimestamp(value.createdAt, "Approval createdAt");
  if (value.policyDecision !== undefined) assertPolicyDecision(value.policyDecision);
  if (value.connectorTrust !== undefined) assertJsonObject(value.connectorTrust, "Approval connectorTrust");
  if (value.provenance !== undefined) assertJsonObject(value.provenance, "Approval provenance");
  if (value.metadata !== undefined) assertJsonObject(value.metadata, "Approval metadata");
}

function assertPolicyDecision(value: unknown): void {
  assertJsonObject(value, "Approval policyDecision");
  const decision = value as Record<string, unknown>;
  if (decision.decision !== "allow" && decision.decision !== "deny" && decision.decision !== "require_approval") throw new TypeError("Approval policyDecision.decision must be allow, deny, or require_approval.");
  assertNonEmptyString(decision.reason, "Approval policyDecision.reason");
  if (decision.approvalPrompt !== undefined && (decision.decision !== "require_approval" || typeof decision.approvalPrompt !== "string" || !decision.approvalPrompt.trim())) throw new TypeError("Approval policyDecision.approvalPrompt must be a non-empty string on require_approval.");
  if (decision.metadata !== undefined) assertJsonObject(decision.metadata, "Approval policyDecision.metadata");
}

export function delegateApprovalTicket(workflow: ApprovalWorkflow, ticket: ApprovalTicket, input: ApprovalDelegationInput): ApprovalTicket {
  assertTicketCanChange(workflow, ticket);
  assertDelegationInput(input);
  const delegatedAt = toIso(input.delegatedAt ?? new Date());
  const stage = getStage(workflow, ticket.stageId);
  getAuthorizedReviewer(ticket, stage, input.fromReviewerId);
  if (stage.reviewers.some((reviewer) => reviewer.id === input.toReviewer.id)) {
    throw new Error(`Reviewer ${input.toReviewer.id} is already assigned to stage ${ticket.stageId}.`);
  }
  if (ticket.delegations.some((delegation) => delegation.stageId === ticket.stageId && delegation.toReviewer.id === input.toReviewer.id)) {
    throw new Error(`Reviewer ${input.toReviewer.id} is already delegated on stage ${ticket.stageId}.`);
  }
  const depth = ticket.delegations.filter((delegation) => delegation.stageId === ticket.stageId).length + 1;
  const maxDepth = workflow.policy?.maxDelegationDepth ?? 1;
  if (depth > maxDepth) {
    throw new Error(`Delegation depth ${depth} exceeds workflow limit ${maxDepth}.`);
  }

  const record: ApprovalDelegationRecord = {
    fromReviewerId: input.fromReviewerId,
    toReviewer: input.toReviewer,
    stageId: ticket.stageId,
    reason: input.reason,
    delegatedAt,
    depth,
    ...(input.metadata === undefined ? {} : { metadata: toJsonObject(input.metadata) })
  };

  return appendHistory(
    {
      ...ticket,
      delegations: [...ticket.delegations, record],
      updatedAt: delegatedAt
    },
    delegatedAt,
    "approval.delegated",
    input.fromReviewerId,
    ticket.stageId,
    ticket.status,
    `Approval delegated to ${input.toReviewer.id}.`,
    { toReviewer: toJsonObject(input.toReviewer), reason: input.reason, ...(input.metadata ?? {}) }
  );
}

export function escalateApprovalTicket(workflow: ApprovalWorkflow, ticket: ApprovalTicket, escalatedAt: string | Date = new Date()): ApprovalTicket {
  assertTicketCanChange(workflow, ticket);
  const timestamp = toIso(escalatedAt);
  const stage = getStage(workflow, ticket.stageId);
  if (!stage.escalation) {
    throw new Error(`Stage ${stage.id} does not define escalation.`);
  }
  const dueAt = addHours(ticket.stageStartedAt, stage.escalation.afterHours).toISOString();
  if (timestamp < dueAt) {
    throw new Error(`Stage ${stage.id} is not due for escalation until ${dueAt}.`);
  }
  const targetStage = stage.escalation.stageId ? getStage(workflow, stage.escalation.stageId) : stage;
  return appendHistory(
    {
      ...ticket,
      status: "escalated",
      stageId: targetStage.id,
      stageStartedAt: targetStage.id === ticket.stageId ? ticket.stageStartedAt : timestamp,
      updatedAt: timestamp
    },
    timestamp,
    "approval.escalated",
    "system",
    targetStage.id,
    "escalated",
    `Approval escalated from stage ${stage.id}.`,
    { previousStageId: stage.id, notify: stage.escalation.notify }
  );
}

export function expireApprovalTicket(workflow: ApprovalWorkflow, ticket: ApprovalTicket, expiredAt: string | Date = new Date()): ApprovalTicket {
  assertTicketCanChange(workflow, ticket);
  const timestamp = toIso(expiredAt);
  if (!ticket.expiresAt) {
    throw new Error("Approval ticket has no expiry.");
  }
  if (timestamp < ticket.expiresAt) {
    throw new Error(`Approval ticket is not due to expire until ${ticket.expiresAt}.`);
  }
  return appendHistory(
    {
      ...ticket,
      status: "expired",
      updatedAt: timestamp
    },
    timestamp,
    "approval.expired",
    "system",
    ticket.stageId,
    "expired",
    "Approval ticket expired."
  );
}

export function cancelApprovalTicket(workflow: ApprovalWorkflow, ticket: ApprovalTicket, input: ApprovalCancelInput): ApprovalTicket {
  assertTicketCanChange(workflow, ticket);
  assertCancelInput(input);
  const cancelledAt = toIso(input.cancelledAt ?? new Date());
  return appendHistory(
    {
      ...ticket,
      status: "cancelled",
      updatedAt: cancelledAt
    },
    cancelledAt,
    "approval.cancelled",
    input.actorId,
    ticket.stageId,
    "cancelled",
    input.reason,
    input.metadata
  );
}

export function computeApprovalTicketDigest(ticket: ApprovalTicket): string {
  return sha256Digest(ticket);
}

export function summarizeApprovalTicket(ticket: ApprovalTicket): JsonObject {
  return {
    id: ticket.id,
    workflowId: ticket.workflowId,
    workflowVersion: ticket.workflowVersion,
    status: ticket.status,
    stageId: ticket.stageId,
    subjectId: ticket.subject.id,
    subjectKind: ticket.subject.kind,
    risk: ticket.subject.risk,
    requestedBy: ticket.requestedBy,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    expiresAt: ticket.expiresAt ?? null,
    decisions: ticket.decisions.length,
    delegations: ticket.delegations.length,
    digest: computeApprovalTicketDigest(ticket)
  };
}

function assertDelegationInput(input: unknown): asserts input is ApprovalDelegationInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Approval delegation input must be a JSON object.");
  const value = input as Record<string, unknown>;
  assertNonEmptyString(value.fromReviewerId, "Approval delegation fromReviewerId");
  assertNonEmptyString(value.reason, "Approval delegation reason");
  assertOptionalTimestamp(value.delegatedAt, "Approval delegatedAt");
  assertJsonObject(value.toReviewer, "Approval delegated reviewer");
  const reviewer = value.toReviewer as Record<string, unknown>;
  assertNonEmptyString(reviewer.id, "Approval delegated reviewer id");
  if (reviewer.kind !== "user" && reviewer.kind !== "group" && reviewer.kind !== "role") throw new TypeError("Approval delegated reviewer kind must be user, group, or role.");
  if (reviewer.displayName !== undefined && (typeof reviewer.displayName !== "string" || !reviewer.displayName.trim())) throw new TypeError("Approval delegated reviewer displayName must be a non-empty string.");
  if (reviewer.required !== undefined && typeof reviewer.required !== "boolean") throw new TypeError("Approval delegated reviewer required must be a boolean.");
  if (value.metadata !== undefined) assertJsonObject(value.metadata, "Approval delegation metadata");
}

function assertCancelInput(input: unknown): asserts input is ApprovalCancelInput {
  if (input === null || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Approval cancellation input must be a JSON object.");
  const value = input as Record<string, unknown>;
  assertNonEmptyString(value.actorId, "Approval cancellation actorId");
  assertNonEmptyString(value.reason, "Approval cancellation reason");
  assertOptionalTimestamp(value.cancelledAt, "Approval cancelledAt");
  if (value.metadata !== undefined) assertJsonObject(value.metadata, "Approval cancellation metadata");
}

function assertJsonObject(value: unknown, label: string): asserts value is JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be a JSON object.`);
  toJsonObject(value);
}

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
}

function assertOptionalTimestamp(value: unknown, label: string): void {
  if (value === undefined) return;
  if (!(typeof value === "string" || value instanceof Date)) throw new TypeError(`${label} must be an ISO timestamp string or Date.`);
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError(`${label} must be a valid timestamp.`);
}

function appendHistory(
  ticket: ApprovalTicket,
  timestamp: string,
  type: ApprovalHistoryEvent["type"],
  actorId: string,
  stageId: string,
  status: ApprovalTicketStatus,
  message: string,
  metadata?: JsonObject
): ApprovalTicket {
  return {
    ...ticket,
    history: [...ticket.history, historyEvent(ticket.history.length + 1, timestamp, type, actorId, stageId, status, message, metadata)]
  };
}

function historyEvent(
  sequence: number,
  timestamp: string,
  type: ApprovalHistoryEvent["type"],
  actorId: string,
  stageId: string,
  status: ApprovalTicketStatus,
  message: string,
  metadata?: JsonObject
): ApprovalHistoryEvent {
  return {
    sequence,
    timestamp,
    type,
    actorId,
    stageId,
    status,
    message,
    ...(metadata === undefined ? {} : { metadata: toJsonObject(metadata) })
  };
}

function requiredApprovalCount(stage: ApprovalStage, ticket: ApprovalTicket): number {
  const reviewerCount = stage.reviewers.length + ticket.delegations.filter((delegation) => delegation.stageId === stage.id).length;
  if (stage.quorum.strategy === "all") {
    return reviewerCount;
  }
  if (stage.quorum.strategy === "majority") {
    return Math.floor(reviewerCount / 2) + 1;
  }
  if (stage.quorum.strategy === "count") {
    return stage.quorum.required ?? 1;
  }
  return 1;
}

function getAuthorizedReviewer(ticket: ApprovalTicket, stage: ApprovalStage, reviewerId: string): ApprovalReviewer {
  const reviewer = stage.reviewers.find((candidate) => candidate.id === reviewerId);
  if (reviewer) {
    return reviewer;
  }
  const delegated = ticket.delegations.find((candidate) => candidate.stageId === stage.id && candidate.toReviewer.id === reviewerId);
  if (delegated) {
    return delegated.toReviewer;
  }
  throw new Error(`Reviewer ${reviewerId} is not authorized for stage ${stage.id}.`);
}

function getStage(workflow: ApprovalWorkflow, stageId: string): ApprovalStage {
  const stage = workflow.stages.find((candidate) => candidate.id === stageId);
  if (!stage) {
    throw new Error(`Stage ${stageId} is not defined by workflow ${workflow.id}.`);
  }
  return stage;
}

function assertTicketCanChange(workflow: ApprovalWorkflow, ticket: ApprovalTicket): void {
  assertValidWorkflow(workflow);
  if (ticket.workflowId !== workflow.id || ticket.workflowVersion !== workflow.version) {
    throw new Error("Ticket workflow identity does not match supplied workflow.");
  }
  if (ticket.workflowDigest !== computeApprovalWorkflowDigest(workflow)) {
    throw new Error("Ticket workflow digest does not match supplied workflow.");
  }
  if (!["pending", "escalated"].includes(ticket.status)) {
    throw new Error(`Approval ticket ${ticket.id} is already ${ticket.status}.`);
  }
}

function assertValidWorkflow(workflow: ApprovalWorkflow): void {
  const result = validateApprovalWorkflow(workflow);
  if (!result.valid) {
    throw new Error(`Invalid approval workflow: ${result.issues.map((item) => `${item.code} ${item.path}`).join("; ")}`);
  }
}

function assertValidSubject(subject: ApprovalRequestInput["subject"]): void {
  const result = validateApprovalSubject(subject);
  if (!result.valid) {
    throw new Error(`Invalid approval subject: ${result.issues.map((item) => `${item.code} ${item.path}`).join("; ")}`);
  }
}

function assertRiskAllowed(workflow: ApprovalWorkflow, risk: string): void {
  const allowed = workflow.policy?.allowedRiskLevels;
  if (allowed && !allowed.includes(risk as ApprovalRequestInput["subject"]["risk"])) {
    throw new Error(`Risk ${risk} is not allowed by workflow ${workflow.id}.`);
  }
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function addHours(value: string, hours: number): Date {
  const date = new Date(value);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date;
}
