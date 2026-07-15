import { sha256Hex, stableJson, toJsonObject } from "./stable-json.js";
import { computeEvalSuiteDigest } from "./validation.js";
import type {
  EvalAuditEvent,
  EvalAuditLedgerOptions,
  EvalAuditReceipt,
  EvalAuditRecordInput,
  VerificationResult
} from "./types.js";

export class EvalAuditLedger {
  private readonly recordedEvents: EvalAuditEvent[] = [];

  private readonly clock: () => Date;
  private previousHash: string | null = null;

  constructor(options: EvalAuditLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  record(input: EvalAuditRecordInput): EvalAuditEvent {
    const assertionCount = input.report.summary.totalAssertions;
    const eventWithoutReceipt: Omit<EvalAuditEvent, "receipt"> = {
      schemaVersion: "ajnas.eval.audit.v1",
      sequence: this.recordedEvents.length + 1,
      timestamp: this.clock().toISOString(),
      actor: input.actor,
      action: input.action,
      suiteId: input.suite.id,
      suiteVersion: input.suite.version,
      suiteDigest: computeEvalSuiteDigest(input.suite),
      reportDigest: input.report.digest,
      caseCount: input.report.summary.totalCases,
      assertionCount
    };
    const receipt = createEvalAuditReceipt(eventWithoutReceipt, this.previousHash);
    const event = {
      ...eventWithoutReceipt,
      receipt
    };
    this.previousHash = receipt.eventHash;
    this.recordedEvents.push(cloneEvent(event));
    return cloneEvent(event);
  }

  get events(): EvalAuditEvent[] {
    return this.recordedEvents.map(cloneEvent);
  }

  verify(): VerificationResult {
    return verifyEvalAuditTrail(this.recordedEvents);
  }
}

function cloneEvent(event: EvalAuditEvent): EvalAuditEvent {
  return toJsonObject(event) as unknown as EvalAuditEvent;
}

export function verifyEvalAuditTrail(events: EvalAuditEvent[]): VerificationResult {
  const issues: string[] = [];
  let previousHash: string | null = null;

  events.forEach((event, index) => {
    const { receipt, ...eventWithoutReceipt } = event;
    const expected = createEvalAuditReceipt(eventWithoutReceipt, previousHash);
    if (receipt.previousHash !== previousHash) {
      issues.push(`event ${index + 1} previousHash mismatch`);
    }
    if (receipt.eventHash !== expected.eventHash) {
      issues.push(`event ${index + 1} hash mismatch`);
    }
    previousHash = receipt.eventHash;
  });

  return {
    valid: issues.length === 0,
    issues
  };
}

function createEvalAuditReceipt(
  eventWithoutReceipt: Omit<EvalAuditEvent, "receipt">,
  previousHash: string | null
): EvalAuditReceipt {
  const canonicalJson = stableJson({
    ...eventWithoutReceipt,
    previousHash
  });
  return {
    eventHash: sha256Hex(canonicalJson),
    previousHash,
    canonicalJson
  };
}
