import { generateKeyPairSync } from "node:crypto";
import {
  TraceLedger,
  createProvenanceExportPolicy,
  createTraceBundle,
  importRuntimeEvent,
  importSkillAuditEvent,
  signTraceBundle,
  verifyTraceBundle,
  verifyTraceBundleSignature
} from "../dist/index.js";

const ledger = new TraceLedger({
  traceId: "trace_release_gate_example",
  clock: () => new Date("2026-07-06T06:20:00.000Z")
});

ledger.record({
  actor: "release-bot",
  action: "approval.requested",
  subject: { type: "package", id: "ajnas-provenance@0.1.0" },
  source: { system: "ajnas-provenance", id: "release-gate" },
  data: {
    destination: "npm",
    dataClasses: ["public"],
    token: "redacted-before-hash"
  }
});

importRuntimeEvent(ledger, {
  runId: "run_release_001",
  sequence: 1,
  type: "policy.evaluated",
  timestamp: "2026-07-06T06:19:00.000Z",
  data: { decision: "require_approval" },
  receipt: {
    eventHash: "runtime_receipt_hash",
    previousHash: null,
    canonicalJson: "{}"
  }
});

importSkillAuditEvent(ledger, {
  sequence: 1,
  timestamp: "2026-07-06T06:18:00.000Z",
  type: "skill.registered",
  actor: "registry",
  skillId: "com.ajnas.release-review",
  version: "1.0.0",
  digest: "sha256:skill_digest",
  data: { source: "fixture" },
  receipt: {
    eventHash: "skill_receipt_hash",
    previousHash: null,
    canonicalJson: "{}"
  }
});

const policy = createProvenanceExportPolicy({
  approvalDestinations: ["npm"],
  sensitiveDataClasses: ["secret", "personal-data"]
});

const decision = policy.evaluate({
  runId: "run_release_001",
  stepId: "export_trace",
  tool: {
    name: "provenance.export",
    description: "Export release provenance",
    risk: "high",
    execute: () => undefined
  },
  input: { destination: "npm", dataClasses: ["public"] },
  metadata: {}
});

const bundle = createTraceBundle(ledger.events, {
  generatedAt: "2026-07-06T06:21:00.000Z",
  generatedBy: "basic-provenance-example",
  purpose: "release-gate"
});
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const signed = signTraceBundle(bundle, {
  algorithm: "ed25519",
  keyId: "example-key",
  privateKey,
  signedAt: "2026-07-06T06:22:00.000Z"
});

console.log(
  JSON.stringify(
    {
      policyDecision: decision.decision,
      eventCount: bundle.eventCount,
      digest: bundle.digest,
      bundleValid: verifyTraceBundle(bundle).valid,
      signatureValid: verifyTraceBundleSignature(signed, publicKey)
    },
    null,
    2
  )
);
