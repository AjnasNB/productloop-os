import { sha256Digest, sha256Hex, stableJson, toJsonObject } from "./stable-json.js";
import { computeConnectorDigest } from "./validation.js";
import type {
  ConnectorAuditEvent,
  ConnectorAuditLedgerOptions,
  ConnectorAuditRecordInput,
  ConnectorAuditReceipt,
  JsonObject,
  VerificationResult
} from "./types.js";

export class HashChainedConnectorAuditLedger {
  private readonly recordedEvents: ConnectorAuditEvent[] = [];
  private readonly clock: () => Date;

  constructor(options: ConnectorAuditLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  record(input: ConnectorAuditRecordInput): ConnectorAuditEvent {
    const sequence = this.recordedEvents.length + 1;
    const previousHash = this.recordedEvents[this.recordedEvents.length - 1]?.receipt.eventHash ?? null;
    const body = compactJsonObject({
      schemaVersion: "ajnas.connector.audit.v1",
      sequence,
      timestamp: this.clock().toISOString(),
      eventType: input.eventType,
      connectorId: input.connectorId,
      connectorVersion: input.connectorVersion,
      actorId: input.actorId,
      manifestDigest: input.manifest ? computeConnectorDigest(input.manifest) : undefined,
      requestDigest: input.request ? sha256Digest(input.request) : undefined,
      decision: input.decision,
      reason: input.reason,
      metadata: input.metadata
    });
    const receipt = createReceipt(body, previousHash);
    const event = { ...body, receipt } as ConnectorAuditEvent;
    this.recordedEvents.push(cloneEvent(event));
    return cloneEvent(event);
  }

  get events(): ConnectorAuditEvent[] {
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
      const body = compactJsonObject({
        schemaVersion: event.schemaVersion,
        sequence: event.sequence,
        timestamp: event.timestamp,
        eventType: event.eventType,
        connectorId: event.connectorId,
        connectorVersion: event.connectorVersion,
        actorId: event.actorId,
        manifestDigest: event.manifestDigest,
        requestDigest: event.requestDigest,
        decision: event.decision,
        reason: event.reason,
        metadata: event.metadata
      });
      const expected = createReceipt(body, previousHash);
      if (event.receipt.eventHash !== expected.eventHash) {
        issues.push(`Event ${event.sequence} hash mismatch.`);
      }
      if (event.receipt.canonicalJson !== expected.canonicalJson) {
        issues.push(`Event ${event.sequence} canonical JSON mismatch.`);
      }
      previousHash = event.receipt.eventHash;
    });

    return { valid: issues.length === 0, issues };
  }
}

function cloneEvent(event: ConnectorAuditEvent): ConnectorAuditEvent {
  return toJsonObject(event) as unknown as ConnectorAuditEvent;
}

export const ConnectorAuditLedger = HashChainedConnectorAuditLedger;

function createReceipt(body: JsonObject, previousHash: string | null): ConnectorAuditReceipt {
  const canonicalJson = stableJson({ ...body, previousHash });
  return {
    eventHash: `sha256:${sha256Hex(canonicalJson)}`,
    previousHash,
    canonicalJson
  };
}

function compactJsonObject(value: Record<string, unknown>): JsonObject {
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      Object.defineProperty(output, key, {
        value: item, enumerable: true, configurable: true, writable: true
      });
    }
  }
  return toJsonObject(output);
}
