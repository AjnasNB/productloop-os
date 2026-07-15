import { toJsonObject } from "./stable-json.js";
import type {
  ApprovalRequestInput,
  ApprovalRisk,
  ApprovalSubject,
  ApprovalTicket,
  ApprovalWorkflow,
  JsonObject
} from "./types.js";

export interface RuntimeApprovalRequest {
  runId: string;
  stepId: string;
  toolName: string;
  risk: ApprovalRisk;
  input: unknown;
  reason: string;
  prompt?: string;
  metadata: Record<string, unknown>;
  bindingDigest: string;
}

export interface RuntimeApprovalResponse {
  approved: boolean;
  approverId: string;
  comment?: string;
  metadata?: JsonObject;
  bindingDigest: string;
}

export interface RuntimeApprover {
  requestApproval(request: RuntimeApprovalRequest): Promise<RuntimeApprovalResponse>;
}

export interface RuntimeApprovalQueue {
  request(input: Omit<ApprovalRequestInput, "createdAt"> & { createdAt?: string | Date }): ApprovalTicket;
  get(id: string): ApprovalTicket | undefined;
}

export interface RuntimeApprovalResolverContext {
  queue: RuntimeApprovalQueue;
  request: RuntimeApprovalRequest;
  workflow: ApprovalWorkflow;
}

export interface RuntimeApprovalSubjectOptions {
  id?: string;
  title?: string;
  summary?: string;
  destinations?: string[];
  dataClasses?: string[];
  artifactDigests?: string[];
  metadata?: JsonObject;
}

export interface RuntimeApproverAdapterOptions {
  queue: RuntimeApprovalQueue;
  workflow:
    | ApprovalWorkflow
    | ((request: RuntimeApprovalRequest) => ApprovalWorkflow | Promise<ApprovalWorkflow>);
  requestedBy: string | ((request: RuntimeApprovalRequest) => string | Promise<string>);
  createSubject?: (
    request: RuntimeApprovalRequest
  ) => ApprovalSubject | Promise<ApprovalSubject>;
  metadata?:
    | JsonObject
    | ((request: RuntimeApprovalRequest) => JsonObject | Promise<JsonObject>);
  resolveTicket?: (
    ticket: ApprovalTicket,
    context: RuntimeApprovalResolverContext
  ) => ApprovalTicket | void | Promise<ApprovalTicket | void>;
}

export class RuntimeApprovalPendingError extends Error {
  readonly code = "AJNAS_APPROVAL_PENDING";
  readonly ticketId: string;
  readonly status: "pending" | "escalated";
  readonly stageId: string;

  constructor(ticket: ApprovalTicket & { status: "pending" | "escalated" }) {
    super(
      `Approval ticket ${ticket.id} is ${ticket.status} at stage ${ticket.stageId}; ` +
        "runtime execution cannot continue until the ticket reaches a terminal state."
    );
    this.name = "RuntimeApprovalPendingError";
    this.ticketId = ticket.id;
    this.status = ticket.status;
    this.stageId = ticket.stageId;
  }
}

export class ApprovalQueueRuntimeApprover implements RuntimeApprover {
  constructor(private readonly options: RuntimeApproverAdapterOptions) {}

  async requestApproval(request: RuntimeApprovalRequest): Promise<RuntimeApprovalResponse> {
    const workflow = await resolveOption(this.options.workflow, request);
    const requestedBy = await resolveOption(this.options.requestedBy, request);
    const unboundSubject = this.options.createSubject
      ? await this.options.createSubject(request)
      : createRuntimeApprovalSubject(request);
    const subject = bindRuntimeApprovalSubject(unboundSubject, request);
    const customMetadata = this.options.metadata
      ? await resolveOption(this.options.metadata, request)
      : {};
    const ticket = this.options.queue.request({
      workflow,
      subject,
      requestedBy,
      reason: request.reason,
      policyDecision: {
        decision: "require_approval",
        reason: request.reason,
        ...(request.prompt === undefined ? {} : { approvalPrompt: request.prompt })
      },
      metadata: toJsonObject({
        ...customMetadata,
        runtimeRunId: request.runId,
        runtimeStepId: request.stepId,
        runtimeToolName: request.toolName,
        runtimeRisk: request.risk,
        runtimeMetadata: request.metadata
      })
    });

    const resolved = this.options.resolveTicket
      ? await this.options.resolveTicket(ticket, {
          queue: this.options.queue,
          request,
          workflow
        })
      : undefined;
    const current = resolved ?? this.options.queue.get(ticket.id) ?? ticket;

    if (current.id !== ticket.id) {
      throw new Error(
        `Runtime approval resolver returned ticket ${current.id}; expected ${ticket.id}.`
      );
    }

    if (computeSubjectDigest(current.subject) !== computeSubjectDigest(subject)) {
      throw new Error(`Runtime approval ticket ${ticket.id} subject changed after it was requested.`);
    }

    return createRuntimeApprovalResponse(current, request.bindingDigest);
  }
}

export function createRuntimeApprover(
  options: RuntimeApproverAdapterOptions
): RuntimeApprover {
  return new ApprovalQueueRuntimeApprover(options);
}

export function createRuntimeApprovalSubject(
  request: RuntimeApprovalRequest,
  options: RuntimeApprovalSubjectOptions = {}
): ApprovalSubject {
  const metadata = toJsonObject(request.metadata);
  return {
    id: options.id ?? `runtime-${request.runId}-${request.stepId}-${request.toolName}`,
    kind: "runtime-tool",
    title: options.title ?? `Review ${request.toolName}`,
    summary: options.summary ?? request.prompt ?? request.reason,
    risk: request.risk,
    requestedAction: request.toolName,
    ...optionalArray("destinations", options.destinations ?? stringArray(metadata.destinations)),
    ...optionalArray("dataClasses", options.dataClasses ?? stringArray(metadata.dataClasses)),
    ...optionalArray("artifactDigests", options.artifactDigests ?? stringArray(metadata.artifactDigests)),
    metadata: toJsonObject({
      ...metadata,
      ...(options.metadata ?? {}),
      runId: request.runId,
      stepId: request.stepId,
      approvalReason: request.reason,
      approvalPrompt: request.prompt ?? null,
      approvalBindingDigest: request.bindingDigest
    })
  };
}

export function createRuntimeApprovalResponse(
  ticket: ApprovalTicket,
  bindingDigest?: string
): RuntimeApprovalResponse {
  const metadata = ticketMetadata(ticket);
  const boundDigest = bindingDigest ?? stringValue(ticket.subject.metadata?.approvalBindingDigest);
  if (!boundDigest) {
    throw new Error(`Approval ticket ${ticket.id} is missing its runtime approval binding digest.`);
  }

  if (ticket.status === "pending" || ticket.status === "escalated") {
    throw new RuntimeApprovalPendingError(
      ticket as ApprovalTicket & { status: "pending" | "escalated" }
    );
  }

  if (ticket.status === "approved") {
    const decision = lastDecision(ticket, "approved");
    return {
      approved: true,
      approverId: decision?.reviewerId ?? terminalActor(ticket),
      bindingDigest: boundDigest,
      ...(decision?.comment ? { comment: decision.comment } : {}),
      metadata
    };
  }

  if (ticket.status === "rejected") {
    const decision = lastDecision(ticket, "rejected");
    return {
      approved: false,
      approverId: decision?.reviewerId ?? terminalActor(ticket),
      bindingDigest: boundDigest,
      ...(decision?.comment ? { comment: decision.comment } : {}),
      metadata
    };
  }

  return {
    approved: false,
    approverId: terminalActor(ticket),
    bindingDigest: boundDigest,
    comment: terminalMessage(ticket),
    metadata
  };
}

async function resolveOption<T>(
  option: T | ((request: RuntimeApprovalRequest) => T | Promise<T>),
  request: RuntimeApprovalRequest
): Promise<T> {
  return typeof option === "function"
    ? (option as (request: RuntimeApprovalRequest) => T | Promise<T>)(request)
    : option;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
}

function lastDecision(
  ticket: ApprovalTicket,
  status: "approved" | "rejected"
): ApprovalTicket["decisions"][number] | undefined {
  return [...ticket.decisions]
    .reverse()
    .find((decision) => decision.decision === status);
}

function terminalActor(ticket: ApprovalTicket): string {
  return (
    [...ticket.history]
      .reverse()
      .find((event) => event.status === ticket.status)?.actorId ?? "approval-workflow"
  );
}

function terminalMessage(ticket: ApprovalTicket): string {
  return (
    [...ticket.history]
      .reverse()
      .find((event) => event.status === ticket.status)?.message ??
    `Approval ticket ${ticket.id} is ${ticket.status}.`
  );
}

function ticketMetadata(ticket: ApprovalTicket): JsonObject {
  return {
    approvalTicketId: ticket.id,
    approvalTicketStatus: ticket.status,
    approvalWorkflowId: ticket.workflowId,
    approvalWorkflowVersion: ticket.workflowVersion,
    approvalStageId: ticket.stageId
  };
}

function bindRuntimeApprovalSubject(subject: ApprovalSubject, request: RuntimeApprovalRequest): ApprovalSubject {
  return {
    ...(toJsonObject(subject) as unknown as ApprovalSubject),
    kind: "runtime-tool",
    risk: request.risk,
    requestedAction: request.toolName,
    metadata: toJsonObject({
      ...(subject.metadata ?? {}),
      runId: request.runId,
      stepId: request.stepId,
      approvalBindingDigest: request.bindingDigest
    })
  };
}

function computeSubjectDigest(subject: ApprovalSubject): string {
  return JSON.stringify(toJsonObject(subject));
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalArray<Key extends "destinations" | "dataClasses" | "artifactDigests">(
  key: Key,
  value: string[] | undefined
): Partial<Record<Key, string[]>> {
  return value === undefined ? {} : { [key]: [...value] } as Record<Key, string[]>;
}
