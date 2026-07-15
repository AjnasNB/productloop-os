import { sha256, stableStringify } from "./stable-json.js";
import { verifyTrace } from "./ledger.js";
import type { CreateTraceBundleOptions, ProvenanceTraceEvent, TraceBundle, VerificationResult } from "./types.js";

export function createTraceBundle(
  events: ProvenanceTraceEvent[],
  options: CreateTraceBundleOptions
): TraceBundle {
  const bundleWithoutDigest = {
    schemaVersion: "ajnas.provenance.bundle.v1" as const,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    generatedBy: options.generatedBy,
    purpose: options.purpose,
    eventCount: events.length,
    rootHash: events.at(-1)?.receipt.eventHash ?? null,
    events
  };

  return {
    ...bundleWithoutDigest,
    digest: computeTraceBundleDigest(bundleWithoutDigest)
  };
}

export function verifyTraceBundle(bundle: TraceBundle): VerificationResult {
  const issues: string[] = [];
  if (bundle.schemaVersion !== "ajnas.provenance.bundle.v1") {
    issues.push(`unsupported bundle schema ${bundle.schemaVersion}`);
  }
  if (bundle.eventCount !== bundle.events.length) {
    issues.push(`event count mismatch: expected ${bundle.eventCount}, received ${bundle.events.length}`);
  }
  const expectedRootHash = bundle.events.at(-1)?.receipt.eventHash ?? null;
  if (bundle.rootHash !== expectedRootHash) {
    issues.push("root hash mismatch");
  }
  const traceResult = verifyTrace(bundle.events);
  issues.push(...traceResult.issues);
  const { digest: _digest, ...bundleWithoutDigest } = bundle;
  const expectedDigest = computeTraceBundleDigest(bundleWithoutDigest);
  if (bundle.digest !== expectedDigest) {
    issues.push("bundle digest mismatch");
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function computeTraceBundleDigest(bundleWithoutDigest: Omit<TraceBundle, "digest">): string {
  return `sha256:${sha256(stableStringify(bundleWithoutDigest))}`;
}
