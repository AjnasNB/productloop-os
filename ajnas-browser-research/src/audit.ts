import type {
  BrowserResearchAuditEvent,
  BrowserResearchAuditLedgerOptions,
  BrowserResearchAuditReceipt,
  VerificationResult
} from "./types.js";
import { normalizeJson, sha256Digest, toJsonObject } from "./stable-json.js";

function receiptHash(input: Omit<BrowserResearchAuditReceipt, "hash">): string {
  return sha256Digest(input);
}

export class BrowserResearchAuditLedger {
  private readonly recordedReceipts: BrowserResearchAuditReceipt[] = [];
  private readonly now: () => string;
  private previousHash: string | null;

  constructor(options: BrowserResearchAuditLedgerOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.previousHash = options.previousHash ?? null;
  }

  record(event: BrowserResearchAuditEvent): BrowserResearchAuditReceipt {
    const receiptWithoutHash: Omit<BrowserResearchAuditReceipt, "hash"> = {
      schema: "ajnas.browser.research.audit-receipt.v1",
      index: this.recordedReceipts.length,
      at: event.at || this.now(),
      eventType: event.type,
      runId: event.runId,
      ...(event.stepId === undefined ? {} : { stepId: event.stepId }),
      payloadHash: sha256Digest(toJsonObject(event.payload)),
      previousHash: this.previousHash
    };
    const receipt = {
      ...receiptWithoutHash,
      hash: receiptHash(receiptWithoutHash)
    };
    this.recordedReceipts.push(cloneReceipt(receipt));
    this.previousHash = receipt.hash;
    return cloneReceipt(receipt);
  }

  get receipts(): BrowserResearchAuditReceipt[] {
    return this.recordedReceipts.map(cloneReceipt);
  }
}

function cloneReceipt(receipt: BrowserResearchAuditReceipt): BrowserResearchAuditReceipt {
  return normalizeJson(receipt) as unknown as BrowserResearchAuditReceipt;
}

export function verifyBrowserResearchAuditTrail(receipts: BrowserResearchAuditReceipt[]): VerificationResult {
  const issues = [];
  let previousHash: string | null = null;

  for (const receipt of receipts) {
    if (receipt.previousHash !== previousHash) {
      issues.push({
        path: `$.audit[${receipt.index}].previousHash`,
        message: "Previous hash does not match the prior receipt",
        severity: "error" as const
      });
    }
    const { hash, ...withoutHash } = receipt;
    const expected = receiptHash(withoutHash);
    if (hash !== expected) {
      issues.push({
        path: `$.audit[${receipt.index}].hash`,
        message: "Receipt hash does not match deterministic receipt contents",
        severity: "error" as const
      });
    }
    previousHash = receipt.hash;
  }

  return {
    valid: issues.length === 0,
    issues
  };
}
