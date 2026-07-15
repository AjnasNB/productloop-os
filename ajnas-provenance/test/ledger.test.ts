import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TraceLedger,
  createProvenanceExportPolicy,
  createTraceBundle,
  importRuntimeEvent,
  importSkillAuditEvent,
  signTraceBundle,
  verifyTrace,
  verifyTraceBundle,
  verifyTraceBundleSignature
} from "../src/index.js";
import type { ProvenanceTraceEvent } from "../src/index.js";

const fixedClock = () => new Date("2026-07-06T06:00:00.000Z");

describe("TraceLedger", () => {
  it("records append-only events with replayable receipt hashes", () => {
    const ledger = new TraceLedger({ traceId: "trace_release_001", clock: fixedClock });

    const first = ledger.record({
      actor: "runtime",
      action: "run.started",
      subject: { type: "run", id: "run_001" },
      source: { system: "ajnas-runtime", id: "run_001" },
      data: { workflow: "release-check" }
    });
    const second = ledger.record({
      actor: "runtime",
      action: "policy.evaluated",
      subject: { type: "policy", id: "publish-gate" },
      source: { system: "ajnas-runtime", id: "run_001" },
      data: { decision: "require_approval" }
    });

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(first.receipt.previousHash).toBeNull();
    expect(second.receipt.previousHash).toBe(first.receipt.eventHash);
    expect(verifyTrace(ledger.events)).toEqual({ valid: true, issues: [] });
  });

  it("detects tampered trace data during replay verification", () => {
    const ledger = new TraceLedger({ traceId: "trace_tamper", clock: fixedClock });
    const event = ledger.record({
      actor: "registry",
      action: "skill.registered",
      subject: { type: "skill", id: "com.ajnas.research-brief@1.0.0" },
      source: { system: "ajnas-skills-registry", id: "registry" },
      data: { digest: "sha256:abc" }
    });

    const tampered: ProvenanceTraceEvent = {
      ...event,
      data: { digest: "sha256:evil" }
    };

    const result = verifyTrace([tampered]);

    expect(result.valid).toBe(false);
    expect(result.issues[0]).toContain("event hash mismatch at sequence 1");
  });

  it("redacts sensitive fields before receipts are calculated", () => {
    const ledger = new TraceLedger({ traceId: "trace_redaction", clock: fixedClock });

    const event = ledger.record({
      actor: "connector",
      action: "connector.called",
      subject: { type: "connector", id: "github" },
      source: { system: "ajnas-connectors", id: "github" },
      data: {
        query: "repo search",
        token: "ghp_secret",
        nested: {
          apiKey: "abc123",
          retained: "safe"
        }
      }
    });

    expect(event.data).toEqual({
      query: "repo search",
      token: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        retained: "safe"
      }
    });
    expect(event.receipt.canonicalJson).not.toContain("ghp_secret");
    expect(event.receipt.canonicalJson).not.toContain("abc123");
  });

  it("imports runtime and skills-registry receipts into one Ajnas trace", () => {
    const ledger = new TraceLedger({ traceId: "trace_imports", clock: fixedClock });

    importRuntimeEvent(ledger, {
      runId: "run_001",
      sequence: 7,
      type: "tool.completed",
      timestamp: "2026-07-06T05:59:00.000Z",
      data: { toolName: "publish.check", result: "waiting_for_approval" },
      receipt: {
        eventHash: "runtime_hash",
        previousHash: "previous_runtime_hash",
        canonicalJson: "{}"
      }
    });
    importSkillAuditEvent(ledger, {
      sequence: 3,
      timestamp: "2026-07-06T05:58:00.000Z",
      type: "skill.registered",
      actor: "release-bot",
      skillId: "com.ajnas.research-brief",
      version: "1.0.0",
      digest: "sha256:skilldigest",
      data: { source: "fixture" },
      receipt: {
        eventHash: "skill_hash",
        previousHash: null,
        canonicalJson: "{}"
      }
    });

    expect(ledger.events.map((event) => event.action)).toEqual([
      "runtime.tool.completed",
      "skills-registry.skill.registered"
    ]);
    expect(ledger.events[0].links).toContainEqual({
      rel: "source-receipt",
      href: "ajnas-runtime:run_001:7",
      digest: "sha256:runtime_hash"
    });
    expect(ledger.events[1].subject).toEqual({
      type: "skill",
      id: "com.ajnas.research-brief@1.0.0"
    });
    expect(verifyTrace(ledger.events).valid).toBe(true);
  });

  it("creates deterministic signed bundles and verifies signatures", () => {
    const ledger = new TraceLedger({ traceId: "trace_bundle", clock: fixedClock });
    ledger.record({
      actor: "release",
      action: "approval.requested",
      subject: { type: "package", id: "ajnas-provenance@0.1.0" },
      source: { system: "ajnas-provenance", id: "release-gate" },
      data: { destination: "npm", dataClasses: ["public"] }
    });
    const bundle = createTraceBundle(ledger.events, {
      generatedAt: "2026-07-06T06:01:00.000Z",
      generatedBy: "daily-oss-skill-and-crawler-research",
      purpose: "release-gate"
    });
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");

    const signed = signTraceBundle(bundle, {
      algorithm: "ed25519",
      keyId: "release-key",
      privateKey,
      signedAt: "2026-07-06T06:02:00.000Z"
    });

    expect(bundle.digest.startsWith("sha256:")).toBe(true);
    expect(verifyTraceBundle(bundle)).toEqual({ valid: true, issues: [] });
    expect(verifyTraceBundleSignature(signed, publicKey)).toBe(true);
    expect(verifyTraceBundleSignature({ ...signed, digest: "sha256:bad" }, publicKey)).toBe(false);
  });

  it("returns runtime-compatible export policy decisions", () => {
    const policy = createProvenanceExportPolicy({
      toolName: "provenance.export",
      blockedDestinations: ["public-web"],
      approvalDestinations: ["npm", "github-release"],
      sensitiveDataClasses: ["secret", "personal-data"]
    });

    expect(
      policy.evaluate({
        runId: "run_001",
        stepId: "step_001",
        tool: { name: "provenance.export", description: "export", risk: "high" },
        input: { destination: "npm", dataClasses: ["secret"] },
        metadata: {}
      })
    ).toMatchObject({
      decision: "require_approval",
      reason: "Provenance export to npm includes sensitive data classes: secret"
    });

    expect(
      policy.evaluate({
        runId: "run_001",
        stepId: "step_002",
        tool: { name: "provenance.export", description: "export", risk: "critical" },
        input: { destination: "public-web", dataClasses: ["public"] },
        metadata: {}
      })
    ).toMatchObject({
      decision: "deny",
      reason: "Provenance export destination public-web is blocked"
    });

    expect(
      policy.evaluate({
        runId: "run_001",
        stepId: "step_003",
        tool: { name: "provenance.export", description: "export", risk: "low" },
        input: { destination: "local-file", dataClasses: ["public"] },
        metadata: {}
      })
    ).toMatchObject({
      decision: "allow",
      reason: "Provenance export is allowed"
    });
  });
});
