import { computeApprovalTicketDigest } from "./workflow.js";
import { sha256Digest, stableJson, toJsonObject } from "./stable-json.js";
import type {
  ApprovalAuditEvent,
  ApprovalAuditLedgerOptions,
  ApprovalAuditRecordInput,
  VerificationResult
} from "./types.js";

export class ApprovalAuditLedger {
  private readonly recordedEvents: ApprovalAuditEvent[] = [];
  private readonly clock: () => Date;

  constructor(options: ApprovalAuditLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  record(input: ApprovalAuditRecordInput): ApprovalAuditEvent {
    const sequence = this.recordedEvents.length + 1;
    const timestamp = this.clock().toISOString();
    const previousHash = this.recordedEvents.at(-1)?.receipt.eventHash ?? null;
    const eventWithoutReceipt = {
      schemaVersion: "ajnas.approval.audit.v1" as const,
      sequence,
      timestamp,
      eventType: input.eventType,
      ticketId: input.ticket.id,
      workflowId: input.ticket.workflowId,
      subjectId: input.ticket.subject.id,
      actorId: input.actorId,
      status: input.ticket.status,
      ticketDigest: computeApprovalTicketDigest(input.ticket),
      ...(input.reason === undefined ? {} : { reason: input.reason }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata })
    };
    const canonicalJson = stableJson({ ...eventWithoutReceipt, previousHash });
    const event: ApprovalAuditEvent = {
      ...eventWithoutReceipt,
      receipt: {
        eventHash: sha256Digest({ canonicalJson, previousHash }),
        previousHash,
        canonicalJson
      }
    };
    this.recordedEvents.push(cloneEvent(event));
    return cloneEvent(event);
  }

  get events(): ApprovalAuditEvent[] {
    return this.recordedEvents.map(cloneEvent);
  }

  verify(): VerificationResult {
    const issues: string[] = [];
    let previousHash: string | null = null;

    this.recordedEvents.forEach((event, index) => {
      if (event.sequence !== index + 1) {
        issues.push(`Event ${index} has sequence ${event.sequence}; expected ${index + 1}.`);
      }
      if (event.receipt.previousHash !== previousHash) {
        issues.push(`Event ${event.sequence} previous hash mismatch.`);
      }
      const { receipt, ...eventWithoutReceipt } = event;
      const canonicalJson = stableJson({ ...eventWithoutReceipt, previousHash });
      if (receipt.canonicalJson !== canonicalJson) {
        issues.push(`Event ${event.sequence} canonical JSON mismatch.`);
      }
      const expectedHash = sha256Digest({ canonicalJson, previousHash });
      if (receipt.eventHash !== expectedHash) {
        issues.push(`Event ${event.sequence} hash mismatch.`);
      }
      previousHash = receipt.eventHash;
    });

    return { valid: issues.length === 0, issues };
  }
}

function cloneEvent(event: ApprovalAuditEvent): ApprovalAuditEvent {
  return toJsonObject(event) as unknown as ApprovalAuditEvent;
}
