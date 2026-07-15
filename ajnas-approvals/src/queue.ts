import {
  cancelApprovalTicket,
  createApprovalTicket,
  delegateApprovalTicket,
  escalateApprovalTicket,
  expireApprovalTicket,
  reviewApprovalTicket
} from "./workflow.js";
import { toJsonObject } from "./stable-json.js";
import type {
  ApprovalCancelInput,
  ApprovalDelegationInput,
  ApprovalQueueOptions,
  ApprovalQueueQuery,
  ApprovalRequestInput,
  ApprovalReviewInput,
  ApprovalTicket,
  ApprovalWorkflow
} from "./types.js";

export class ApprovalQueue {
  private readonly tickets = new Map<string, ApprovalTicket>();
  private readonly clock: () => Date;
  private readonly audit: ApprovalQueueOptions["audit"];

  constructor(options: ApprovalQueueOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.audit = options.audit;
    for (const ticket of options.tickets ?? []) {
      if (this.tickets.has(ticket.id)) throw new Error(`Approval ticket ${ticket.id} already exists.`);
      this.tickets.set(ticket.id, cloneTicket(ticket));
    }
  }

  request(input: Omit<ApprovalRequestInput, "createdAt"> & { createdAt?: string | Date }): ApprovalTicket {
    const ticket = createApprovalTicket({ ...input, createdAt: input.createdAt ?? this.clock() });
    if (this.tickets.has(ticket.id)) throw new Error(`Approval ticket ${ticket.id} already exists.`);
    const stored = cloneTicket(ticket);
    this.tickets.set(stored.id, stored);
    this.audit?.record({ eventType: "approval.requested", ticket: cloneTicket(stored), actorId: stored.requestedBy, reason: stored.reason });
    return cloneTicket(stored);
  }

  import(ticket: ApprovalTicket): ApprovalTicket {
    if (this.tickets.has(ticket.id)) throw new Error(`Approval ticket ${ticket.id} already exists.`);
    const stored = cloneTicket(ticket);
    this.tickets.set(stored.id, stored);
    return cloneTicket(stored);
  }

  review(id: string, workflow: ApprovalWorkflow, input: Omit<ApprovalReviewInput, "reviewedAt"> & { reviewedAt?: string | Date }): ApprovalTicket {
    const ticket = this.require(id);
    const updated = reviewApprovalTicket(workflow, ticket, { ...input, reviewedAt: input.reviewedAt ?? this.clock() });
    this.tickets.set(id, cloneTicket(updated));
    this.audit?.record({
      eventType: "approval.reviewed",
      ticket: updated,
      actorId: input.reviewerId,
      reason: input.comment
    });
    return cloneTicket(updated);
  }

  delegate(id: string, workflow: ApprovalWorkflow, input: Omit<ApprovalDelegationInput, "delegatedAt"> & { delegatedAt?: string | Date }): ApprovalTicket {
    const ticket = this.require(id);
    const updated = delegateApprovalTicket(workflow, ticket, { ...input, delegatedAt: input.delegatedAt ?? this.clock() });
    this.tickets.set(id, cloneTicket(updated));
    this.audit?.record({
      eventType: "approval.delegated",
      ticket: updated,
      actorId: input.fromReviewerId,
      reason: input.reason
    });
    return cloneTicket(updated);
  }

  escalate(id: string, workflow: ApprovalWorkflow, escalatedAt: string | Date = this.clock()): ApprovalTicket {
    const ticket = this.require(id);
    const updated = escalateApprovalTicket(workflow, ticket, escalatedAt);
    this.tickets.set(id, cloneTicket(updated));
    this.audit?.record({ eventType: "approval.escalated", ticket: updated, actorId: "system" });
    return cloneTicket(updated);
  }

  expire(id: string, workflow: ApprovalWorkflow, expiredAt: string | Date = this.clock()): ApprovalTicket {
    const ticket = this.require(id);
    const updated = expireApprovalTicket(workflow, ticket, expiredAt);
    this.tickets.set(id, cloneTicket(updated));
    this.audit?.record({ eventType: "approval.expired", ticket: updated, actorId: "system" });
    return cloneTicket(updated);
  }

  cancel(id: string, workflow: ApprovalWorkflow, input: Omit<ApprovalCancelInput, "cancelledAt"> & { cancelledAt?: string | Date }): ApprovalTicket {
    const ticket = this.require(id);
    const updated = cancelApprovalTicket(workflow, ticket, { ...input, cancelledAt: input.cancelledAt ?? this.clock() });
    this.tickets.set(id, cloneTicket(updated));
    this.audit?.record({
      eventType: "approval.cancelled",
      ticket: updated,
      actorId: input.actorId,
      reason: input.reason
    });
    return cloneTicket(updated);
  }

  get(id: string): ApprovalTicket | undefined {
    const ticket = this.tickets.get(id);
    return ticket ? cloneTicket(ticket) : undefined;
  }

  list(query: ApprovalQueueQuery = {}): ApprovalTicket[] {
    return [...this.tickets.values()]
      .filter((ticket) => query.status === undefined || ticket.status === query.status)
      .filter((ticket) => query.workflowId === undefined || ticket.workflowId === query.workflowId)
      .filter((ticket) => query.subjectKind === undefined || ticket.subject.kind === query.subjectKind)
      .filter((ticket) => query.requestedBy === undefined || ticket.requestedBy === query.requestedBy)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map(cloneTicket);
  }

  exportSnapshot(): ApprovalTicket[] {
    const snapshot = this.list();
    this.audit?.record({
      eventType: "approval.snapshot_exported",
      ticket: snapshot[0] ?? emptySnapshotTicket(),
      actorId: "system",
      reason: `Exported ${snapshot.length} approval tickets.`
    });
    return snapshot;
  }

  private require(id: string): ApprovalTicket {
    const ticket = this.tickets.get(id);
    if (!ticket) {
      throw new Error(`Approval ticket ${id} was not found.`);
    }
    return cloneTicket(ticket);
  }
}

function cloneTicket(ticket: ApprovalTicket): ApprovalTicket {
  return toJsonObject(ticket) as unknown as ApprovalTicket;
}

function emptySnapshotTicket(): ApprovalTicket {
  const timestamp = new Date(0).toISOString();
  return {
    schemaVersion: "ajnas.approval.ticket.v1",
    id: "approval-snapshot-empty",
    workflowId: "snapshot",
    workflowVersion: "0.0.0",
    workflowDigest: "sha256:empty",
    status: "pending",
    stageId: "snapshot",
    stageStartedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    requestedBy: "system",
    reason: "empty snapshot",
    subject: {
      id: "snapshot",
      kind: "custom",
      title: "Snapshot",
      summary: "Empty approval snapshot",
      risk: "low",
      requestedAction: "snapshot.export"
    },
    decisions: [],
    delegations: [],
    history: []
  };
}
