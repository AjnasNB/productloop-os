import { sanitizeJson, stableStringify, sha256 } from "./stable-json.js";
import type { JsonObject, SkillAuditEvent, SkillAuditLedgerOptions, SkillAuditSink } from "./types.js";

export class SkillAuditLedger implements SkillAuditSink {
  private readonly recordedEvents: SkillAuditEvent[] = [];
  private readonly clock: () => Date;
  private previousHash: string | null = null;

  constructor(options: SkillAuditLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  record(event: Omit<SkillAuditEvent, "sequence" | "timestamp" | "receipt">): SkillAuditEvent {
    const eventWithoutReceipt = {
      ...event,
      sequence: this.recordedEvents.length + 1,
      timestamp: this.clock().toISOString()
    };
    const canonicalJson = stableStringify({
      ...eventWithoutReceipt,
      data: sanitizeJson(eventWithoutReceipt.data) as JsonObject,
      receipt: {
        previousHash: this.previousHash
      }
    });
    const recorded: SkillAuditEvent = {
      ...eventWithoutReceipt,
      data: sanitizeJson(eventWithoutReceipt.data) as JsonObject,
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

  get events(): SkillAuditEvent[] {
    return this.recordedEvents.map(cloneEvent);
  }

  toJSON(): { events: SkillAuditEvent[] } {
    return {
      events: this.recordedEvents.map(cloneEvent)
    };
  }
}

function cloneEvent(event: SkillAuditEvent): SkillAuditEvent {
  return sanitizeJson(event) as unknown as SkillAuditEvent;
}
