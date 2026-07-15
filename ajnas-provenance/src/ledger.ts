import { randomUUID } from "node:crypto";
import { sanitizeJson, sanitizeJsonObject, sha256, stableStringify } from "./stable-json.js";
import type {
  ProvenanceTraceEvent,
  RecordTraceEventInput,
  TraceLedgerOptions,
  VerificationResult
} from "./types.js";

export class TraceLedger {
  readonly traceId: string;
  private readonly recordedEvents: ProvenanceTraceEvent[] = [];
  private readonly clock: () => Date;
  private readonly redactionKeys: string[];
  private previousHash: string | null = null;

  constructor(options: TraceLedgerOptions = {}) {
    this.traceId = options.traceId ?? `trace_${randomUUID()}`;
    this.clock = options.clock ?? (() => new Date());
    this.redactionKeys = options.redactionKeys ?? [];
  }

  record(input: RecordTraceEventInput): ProvenanceTraceEvent {
    const eventWithoutReceipt = {
      schemaVersion: "ajnas.provenance.event.v1" as const,
      traceId: this.traceId,
      sequence: this.recordedEvents.length + 1,
      timestamp: this.clock().toISOString(),
      actor: input.actor,
      action: input.action,
      subject: sanitizeJson(input.subject, this.redactionKeys) as unknown as ProvenanceTraceEvent["subject"],
      source: sanitizeJson(input.source, this.redactionKeys) as unknown as ProvenanceTraceEvent["source"],
      data: sanitizeJsonObject(input.data ?? {}, this.redactionKeys),
      links: sanitizeJson(input.links ?? [], this.redactionKeys) as unknown as ProvenanceTraceEvent["links"]
    };
    const canonicalJson = stableStringify({
      ...eventWithoutReceipt,
      receipt: {
        previousHash: this.previousHash
      }
    });
    const recorded: ProvenanceTraceEvent = {
      ...eventWithoutReceipt,
      receipt: {
        eventHash: sha256(canonicalJson),
        previousHash: this.previousHash,
        canonicalJson
      }
    };

    this.previousHash = recorded.receipt.eventHash;
    this.recordedEvents.push(cloneEvent(recorded));
    return cloneEvent(recorded);
  }

  get events(): ProvenanceTraceEvent[] {
    return this.recordedEvents.map(cloneEvent);
  }
}

function cloneEvent(event: ProvenanceTraceEvent): ProvenanceTraceEvent {
  return sanitizeJson(event) as unknown as ProvenanceTraceEvent;
}

export function verifyTrace(events: ProvenanceTraceEvent[]): VerificationResult {
  const issues: string[] = [];
  let previousHash: string | null = null;

  events.forEach((event, index) => {
    const expectedSequence = index + 1;
    if (event.sequence !== expectedSequence) {
      issues.push(`sequence mismatch at index ${index}: expected ${expectedSequence}, received ${event.sequence}`);
    }

    const { receipt, ...eventWithoutReceipt } = event;
    const canonicalJson = stableStringify({
      ...eventWithoutReceipt,
      receipt: {
        previousHash: receipt.previousHash
      }
    });
    const eventHash = sha256(canonicalJson);

    if (eventHash !== receipt.eventHash) {
      issues.push(`event hash mismatch at sequence ${event.sequence}`);
    }
    if (receipt.canonicalJson !== canonicalJson) {
      issues.push(`canonical json mismatch at sequence ${event.sequence}`);
    }
    if (receipt.previousHash !== previousHash) {
      issues.push(`previous hash mismatch at sequence ${event.sequence}`);
    }

    previousHash = receipt.eventHash;
  });

  return {
    valid: issues.length === 0,
    issues
  };
}
