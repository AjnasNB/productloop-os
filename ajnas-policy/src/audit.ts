import { createHash } from "node:crypto";
import { runtimeRequestDigest } from "./evaluator.js";
import { stableJson, toJsonObject } from "./stable-json.js";
import type {
  PolicyDecisionAuditInput,
  PolicyDecisionEvent,
  PolicyDecisionLedgerOptions,
  PolicyDecisionReceipt,
  VerificationResult
} from "./types.js";

export class PolicyDecisionLedger {
  private readonly recordedEvents: PolicyDecisionEvent[] = [];

  private readonly clock: () => Date;
  private previousHash: string | null = null;

  constructor(options: PolicyDecisionLedgerOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
  }

  record(input: PolicyDecisionAuditInput): PolicyDecisionEvent {
    const metadata = input.decision.metadata ?? {};
    const selectedRuleId = typeof metadata.selectedRuleId === "string" ? metadata.selectedRuleId : null;
    const matchedRuleIds = Array.isArray(metadata.matchedRuleIds)
      ? metadata.matchedRuleIds.filter((item): item is string => typeof item === "string")
      : [];
    const eventWithoutReceipt: Omit<PolicyDecisionEvent, "receipt"> = {
      schemaVersion: "ajnas.policy.decision.v1",
      sequence: this.recordedEvents.length + 1,
      timestamp: this.clock().toISOString(),
      policyBundleId: input.bundle.id,
      policyBundleVersion: input.bundle.version,
      runId: input.request.runId,
      stepId: input.request.stepId,
      toolName: input.request.tool.name,
      decision: input.decision.decision,
      reason: input.decision.reason,
      matchedRuleIds,
      selectedRuleId,
      requestDigest: runtimeRequestDigest(input.request)
    };
    const receipt = createReceipt(eventWithoutReceipt, this.previousHash);
    const event: PolicyDecisionEvent = {
      ...eventWithoutReceipt,
      receipt
    };
    this.previousHash = receipt.eventHash;
    this.recordedEvents.push(cloneEvent(event));
    return cloneEvent(event);
  }

  get events(): PolicyDecisionEvent[] {
    return this.recordedEvents.map(cloneEvent);
  }

  verify(): VerificationResult {
    const issues: string[] = [];
    let previousHash: string | null = null;

    this.recordedEvents.forEach((event, index) => {
      const { receipt, ...eventWithoutReceipt } = event;
      const expected = createReceipt(eventWithoutReceipt, previousHash);
      if (receipt.previousHash !== previousHash) {
        issues.push(`event ${index + 1} has previousHash ${receipt.previousHash} but expected ${previousHash}`);
      }
      if (receipt.eventHash !== expected.eventHash) {
        issues.push(`event ${index + 1} receipt hash does not match canonical event`);
      }
      previousHash = receipt.eventHash;
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }
}

function cloneEvent(event: PolicyDecisionEvent): PolicyDecisionEvent {
  return toJsonObject(event) as unknown as PolicyDecisionEvent;
}

function createReceipt<TEvent extends object>(event: TEvent, previousHash: string | null): PolicyDecisionReceipt {
  const canonicalJson = stableJson({
    ...event,
    previousHash
  });
  return {
    eventHash: createHash("sha256").update(canonicalJson).digest("hex"),
    previousHash,
    canonicalJson
  };
}
